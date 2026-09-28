/*
 * AccessControlService implementation — server-side authority (R-UI-13) resolved as of an
 * instant (R-DM-03).
 *
 * Design notes:
 *
 * 1. Every check is a privilege-key membership test against AppRole.privileges. No role
 *    names are hard-coded in the logic, so the RBAC matrix is reviewable seed data.
 *
 * 2. rolesFor() takes a time and defaults to now. Authority is never a static property of
 *    a user, because AuditEvent.actorRoleAtTime must record the authority in force at the
 *    moment of the action even after the person has moved teams.
 *
 * 3. Errors name both the missing privilege and the roles actually held. A 403 that says
 *    only "forbidden" costs a support engineer a log dive; this one is self-diagnosing.
 *
 * 4. A person with no assignment gets no privileges and role key "Unassigned" — never
 *    null, and never a default grant. Failing closed is the only safe default for a
 *    GxP-relevant control.
 */

function forEach(list, fn) {
  if (!list) return;
  if (typeof list.each === 'function') { list.each(fn); return; }
  for (var i = 0; i < list.length; i++) fn(list[i], i);
}

/**
 * Role authority ranking, highest first — used only to choose which role key to stamp on
 * an audit event when a person holds several. Deliberately not used to *grant* anything:
 * privilege membership is the grant, and a monotonic rank could not express "the Auditor
 * sees more than a Site Planner but may change less" (see AppRole's documentation).
 */
var ROLE_RANK = ['Executive', 'QualityQP', 'LaunchLead', 'Commercial', 'SitePlanner', 'Auditor'];

function rankOf(roleKey) {
  for (var i = 0; i < ROLE_RANK.length; i++) if (ROLE_RANK[i] === roleKey) return i;
  return ROLE_RANK.length;
}

/**
 * The assignments in force for a person at an instant.
 *
 * A null validFrom means "always been in force" and a null validTo means "still in
 * force"; both are treated as open, so a seeded assignment with no window still answers.
 */
function assignmentsFor(personId, asOf) {
  var at = asOf ? DateTime.fromString('' + asOf) : DateTime.now();

  var res = RoleAssignment.fetch({
    filter: Filter.eq('person', personId),
    include: 'id, raci, scopeEntityTypeName, scopeEntityId, validFrom, validTo, ' +
             'role.id, role.roleKey, role.name, role.privileges, role.canSignDisposition, ' +
             'role.canApproveGovernanceReversal, role.spendAuthorityUsd, team.id, team.teamKey, team.name',
    limit: -1
  });

  var live = [];
  forEach(res.objs, function (ra) {
    // C3 datetimes compare with the relational operators; .getTime() is unavailable.
    if (ra.validFrom && ra.validFrom > at) return;
    if (ra.validTo && ra.validTo <= at) return;
    if (!ra.role) return;
    live.push(ra);
  });
  return live;
}

function rolesFor(personId, asOf) {
  var live = assignmentsFor(personId, asOf);
  var roles = [];
  forEach(live, function (ra) {
    roles.push({
      assignmentId: ra.id,
      roleKey: ra.role.roleKey,
      name: ra.role.name,
      raci: ra.raci || null,
      teamKey: ra.team ? ra.team.teamKey : null,
      teamName: ra.team ? ra.team.name : null,
      scopeEntityTypeName: ra.scopeEntityTypeName || null,
      scopeEntityId: ra.scopeEntityId || null,
      privileges: ra.role.privileges || [],
      canSignDisposition: ra.role.canSignDisposition === true,
      canApproveGovernanceReversal: ra.role.canApproveGovernanceReversal === true,
      spendAuthorityUsd: ra.role.spendAuthorityUsd === undefined ? null : ra.role.spendAuthorityUsd,
      validFrom: ra.validFrom ? '' + ra.validFrom : null,
      validTo: ra.validTo ? '' + ra.validTo : null
    });
  });

  return {
    personId: personId,
    asOf: '' + (asOf ? DateTime.fromString('' + asOf) : DateTime.now()),
    roles: roles,
    roleCount: roles.length
  };
}

function privilegesFor(personId) {
  var r = rolesFor(personId, null);
  var set = {};
  var roleKeys = [];
  forEach(r.roles, function (role) {
    roleKeys.push(role.roleKey);
    forEach(role.privileges, function (p) { set[p] = true; });
  });

  var privileges = [];
  for (var p in set) if (Object.prototype.hasOwnProperty.call(set, p)) privileges.push(p);

  return { personId: personId, privileges: privileges, roleKeys: roleKeys };
}

function can(personId, privilege) {
  if (!personId || !privilege) return false;
  var pf = privilegesFor(personId);
  for (var i = 0; i < pf.privileges.length; i++) {
    if (pf.privileges[i] === privilege) return true;
    // A trailing wildcard grants a whole family, e.g. "gate.*" covers "gate.approve".
    var g = pf.privileges[i];
    if (g.charAt(g.length - 1) === '*' && privilege.indexOf(g.substring(0, g.length - 1)) === 0) return true;
  }
  return false;
}

function assertCan(personId, privilege) {
  if (can(personId, privilege)) return true;

  var pf = privilegesFor(personId);
  var held = pf.roleKeys.length > 0 ? pf.roleKeys.join(', ') : 'none';
  throw new Error(
    'Not authorized: this action requires the "' + privilege + '" privilege. ' +
    'User "' + personId + '" holds role(s): ' + held + '. ' +
    'Access is enforced server-side (R-UI-13) — the control being reachable in the UI ' +
    'does not confer the privilege.'
  );
}

function primaryRoleKeyFor(personId) {
  var r = rolesFor(personId, null);
  if (r.roles.length === 0) return 'Unassigned';

  var best = r.roles[0].roleKey;
  var bestRank = rankOf(best);
  for (var i = 1; i < r.roles.length; i++) {
    var rk = rankOf(r.roles[i].roleKey);
    if (rk < bestRank) { bestRank = rk; best = r.roles[i].roleKey; }
  }
  return best;
}

function raciFor(entityTypeName, entityId, asOf) {
  var at = asOf ? DateTime.fromString('' + asOf) : DateTime.now();

  var res = RoleAssignment.fetch({
    filter: Filter.eq('scopeEntityTypeName', entityTypeName).and(Filter.eq('scopeEntityId', entityId)),
    include: 'id, raci, validFrom, validTo, person.id, person.name, person.role, ' +
             'role.roleKey, team.teamKey, team.name',
    limit: -1
  });

  var out = {
    entityTypeName: entityTypeName,
    entityId: entityId,
    asOf: '' + at,
    responsible: [], accountable: [], consulted: [], informed: []
  };

  forEach(res.objs, function (ra) {
    if (ra.validFrom && ra.validFrom > at) return;
    if (ra.validTo && ra.validTo <= at) return;
    if (!ra.person) return;

    var entry = {
      personId: ra.person.id,
      personName: ra.person.name,
      personTitle: ra.person.role || null,
      roleKey: ra.role ? ra.role.roleKey : null,
      teamKey: ra.team ? ra.team.teamKey : null,
      teamName: ra.team ? ra.team.name : null
    };

    switch (ra.raci) {
      case 'R': out.responsible.push(entry); break;
      case 'A': out.accountable.push(entry); break;
      case 'C': out.consulted.push(entry); break;
      case 'I': out.informed.push(entry); break;
      default: break;   // a plain grant with no RACI meaning
    }
  });

  return out;
}

function roleMatrix() {
  var res = AppRole.fetch({ include: 'this', order: 'ascending(roleKey)', limit: -1 });

  var privSet = {};
  var roles = [];
  forEach(res.objs, function (r) {
    roles.push({
      roleKey: r.roleKey,
      name: r.name,
      description: r.description || null,
      privileges: r.privileges || [],
      canSignDisposition: r.canSignDisposition === true,
      canApproveGovernanceReversal: r.canApproveGovernanceReversal === true,
      spendAuthorityUsd: r.spendAuthorityUsd === undefined ? null : r.spendAuthorityUsd
    });
    forEach(r.privileges, function (p) { privSet[p] = true; });
  });

  var privileges = [];
  for (var p in privSet) if (Object.prototype.hasOwnProperty.call(privSet, p)) privileges.push(p);
  privileges.sort();

  var matrix = {};
  forEach(roles, function (r) {
    var row = {};
    for (var i = 0; i < privileges.length; i++) {
      var priv = privileges[i];
      var has = false;
      for (var j = 0; j < r.privileges.length; j++) {
        var g = r.privileges[j];
        if (g === priv) { has = true; break; }
        if (g.charAt(g.length - 1) === '*' && priv.indexOf(g.substring(0, g.length - 1)) === 0) { has = true; break; }
      }
      row[priv] = has;
    }
    matrix[r.roleKey] = row;
  });

  return { roles: roles, roleCount: roles.length, privileges: privileges, matrix: matrix };
}

function assertSpendAuthority(personId, amountUsd) {
  var amount = amountUsd || 0;
  var r = rolesFor(personId, null);

  var limit = 0;
  var limitRole = null;
  forEach(r.roles, function (role) {
    var a = role.spendAuthorityUsd;
    if (a !== null && a !== undefined && a > limit) { limit = a; limitRole = role.roleKey; }
  });

  if (amount <= limit) return true;

  throw new Error(
    'Spend authority exceeded: this commitment is $' + amount.toFixed(0) +
    ' but user "' + personId + '" is authorised to $' + limit.toFixed(0) +
    (limitRole ? ' as ' + limitRole : ' (no spend-authorised role held)') +
    '. The commitment must be approved by a role carrying sufficient authority ' +
    '(R-S2-05 check 7).'
  );
}

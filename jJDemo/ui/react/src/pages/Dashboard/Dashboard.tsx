/*
 * Copyright 2009-2026 C3 AI (www.c3.ai). All Rights Reserved.
 * Confidential and Proprietary C3 Materials.
 * This material, including without limitation any software, is the confidential trade secret and proprietary
 * information of C3 and its licensors. Reproduction, use and/or distribution of this material in any form is
 * strictly prohibited except as set forth in a written license agreement with C3 and/or its authorized distributors.
 * This material may be covered by one or more patents or pending patent applications.
 */

import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
      <h1 className="text-lg font-semibold">Hey, welcome! 👋</h1>
      <p className="text-secondary max-w-md">
        You&apos;re on the <span className="font-medium text-primary">Dashboard</span> page — this is where things
        will live once we start building. Let&apos;s make this page yours!
      </p>
    </div>
  );
};

export default Dashboard;

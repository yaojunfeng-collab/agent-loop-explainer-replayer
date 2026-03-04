/**
 * AGENT LOOP REPLAYER - DATA DEFINITIONS
 * Based on real Codex rollout log structure:
 * turn_context → response_item.message/function_call/function_call_output
 * ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
 */

const THREADS = [
  // =====================================================================
  // THREAD 0: Bug Fix Task  (演示 失败→修复→重试)
  // =====================================================================
  {
    id: "thread-abc123",
    title: "任务 A：修复 Bug",
    description: "用户请求修复一个 `parseUser` 函数的边界问题，Agent 在 3 轮里完成了「定位 → 修复 → 回归验证」的完整流程。",
    mode: "Default",
    model: "gpt-4.1-codex",
    turns: [
      {
        id: "turn-1",
        label: "Turn 1",
        goal: "找到 parseUser 函数定义",
        status: "✅",
        stepCount: 3,
        hasModeSwitch: false,
        steps: [
          {
            type: "PLAN",
            title: "制定搜索计划",
            desc: "Agent 决定先搜索 `parseUser` 的定义位置，再读取具体文件内容。",
            inputSummary: "developer: Default模式指令\nuser: '帮我找 parseUser 的定义'",
            outputSummary: "commentary: '我来搜索 parseUser 的定义...'",
            developerContent: `# Codex Default Mode
你是一个 coding agent。在 Default 模式下，你应该：
- 优先直接执行，减少不必要的确认
- 先做力所能及的事，必要时才询问
- 使用工具搜索、读取、修改代码

collaboration_mode: default
sandbox_policy: network-disabled
approval_policy: on-failure`,
            userContent: `帮我找一下 parseUser 函数定义在哪里`,
            historyContent: `[空 - 本 Thread 第一条消息]`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: 0.1, label: "PLAN 制定", rubric: [
              { ok: true,  text: "正确识别任务需要先搜索定位" },
              { ok: true,  text: "输出了清晰的行动意图" },
              { ok: null,  text: "尚未产生实际结果" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "搜索函数定义",
            desc: "调用 `exec_command` 工具执行 `rg parseUser --type ts` 定位函数所在文件。",
            inputSummary: "history: [PLAN注释]\ntool_schema: exec_command",
            outputSummary: "function_call: exec_command({cmd: ['rg','parseUser','--type','ts']})",
            developerContent: `# Codex Default Mode  [同 Step 1]
collaboration_mode: default`,
            userContent: `帮我找一下 parseUser 函数定义在哪里`,
            historyContent: `[assistant] 让我搜索 parseUser 的定义位置...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["rg", "parseUser", "--type", "ts", "-n"] }`,
              stdout: `src/auth/user.ts:42:export function parseUser(raw: string): User {
src/auth/__tests__/user.test.ts:18:  const result = parseUser('{"id":"123"}');`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "step", score: 0.3, label: "工具调用有效", rubric: [
              { ok: true,  text: "选择了正确的搜索工具 rg" },
              { ok: true,  text: "找到了目标函数（2处引用）" },
              { ok: true,  text: "工具调用参数结构正确" },
            ]},
            quiz: null,
          },
          {
            type: "ANSWER",
            title: "报告搜索结果",
            desc: "根据工具返回结果，Agent 整合信息给出最终答复，完成本 Turn 任务。",
            inputSummary: "history: [PLAN, exec结果]\ntool_outputs: [rg 结果]",
            outputSummary: "message: 'parseUser 定义在 src/auth/user.ts:42'",
            developerContent: `# Codex Default Mode  [同 Step 1]`,
            userContent: `帮我找一下 parseUser 函数定义在哪里`,
            historyContent: `[assistant] 让我搜索 parseUser 的定义位置...
[function_call] exec_command(["rg","parseUser","--type","ts"])
[function_call_output] src/auth/user.ts:42:export function parseUser...`,
            toolIO: null,
            diff: null,
            reward: { type: "turn", score: 0.8, label: "Turn 1 完成", rubric: [
              { ok: true,  text: "准确回答了用户的定位问题" },
              { ok: true,  text: "引用了具体文件路径和行号" },
              { ok: true,  text: "步骤精简（3步），无冗余" },
            ]},
            quiz: null,
          },
        ]
      },
      {
        id: "turn-2",
        label: "Turn 2",
        goal: "修复 parseUser 空值 Bug + 通过测试",
        status: "✅",
        stepCount: 7,
        hasModeSwitch: false,
        steps: [
          {
            type: "PLAN",
            title: "制定修复计划",
            desc: "用户要求修复一个边界 Bug。Agent 制定多步计划：读文件 → 写修复 → 跑测试。",
            inputSummary: "history: [Turn1全部]\nuser: '修复 parseUser 空输入 crash'",
            outputSummary: "update_plan: [读文件, 修复, 跑测试]",
            developerContent: `# Codex Default Mode
collaboration_mode: default
approval_policy: on-failure`,
            userContent: `parseUser 传入空字符串时会 crash，请修复并确保测试通过`,
            historyContent: `[Turn 1 完整记录]
[user] parseUser 传入空字符串时会 crash...`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: 0.1, label: "PLAN", rubric: [
              { ok: true, text: "识别需要先读取源文件" },
              { ok: true, text: "计划包含验证（跑测试）" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "读取源文件",
            desc: "读取 `src/auth/user.ts` 查看当前实现细节。",
            inputSummary: "history: [PLAN]\ntool: exec_command(cat)",
            outputSummary: "function_call: exec_command({cmd: ['cat','src/auth/user.ts']})",
            developerContent: `# Codex Default Mode`,
            userContent: `parseUser 传入空字符串时会 crash，请修复并确保测试通过`,
            historyContent: `[PLAN] 读文件 → 修复 → 跑测试
[assistant] 先读取源文件查看当前实现...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["cat", "src/auth/user.ts"] }`,
              stdout: `export interface User { id: string; name: string; }

export function parseUser(raw: string): User {
  return JSON.parse(raw);  // BUG: no null/empty check!
}`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "step", score: 0.15, label: "读文件", rubric: [
              { ok: true, text: "定位到了具体的 BUG 行" },
            ]},
            quiz: null,
          },
          {
            type: "EDIT",
            title: "应用修复补丁",
            desc: "使用 `apply_patch` 工具给 `parseUser` 添加空值检查，修复 crash 问题。",
            inputSummary: "history: [文件内容]\ntool: apply_patch",
            outputSummary: "function_call: apply_patch(增加空值校验逻辑)",
            developerContent: `# Codex Default Mode`,
            userContent: `parseUser 传入空字符串时会 crash，请修复...`,
            historyContent: `...
[function_call_output] export function parseUser(raw: string): User {
  return JSON.parse(raw);  // BUG: no null/empty check!
}`,
            toolIO: {
              name: "apply_patch",
              args: `*** Begin Patch
*** Update File: src/auth/user.ts
@@ export function parseUser(raw: string): User {
-  return JSON.parse(raw);
+  if (!raw || raw.trim() === '') {
+    throw new Error('parseUser: input cannot be empty');
+  }
+  const parsed = JSON.parse(raw);
+  return parsed as User;
*** End Patch`,
              stdout: "Patch applied successfully.",
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: `diff --git a/src/auth/user.ts b/src/auth/user.ts
index a1b2c3d..d4e5f6g 100644
--- a/src/auth/user.ts
+++ b/src/auth/user.ts
@@ -3,5 +3,8 @@
 export function parseUser(raw: string): User {
-  return JSON.parse(raw);
+  if (!raw || raw.trim() === '') {
+    throw new Error('parseUser: input cannot be empty');
+  }
+  const parsed = JSON.parse(raw);
+  return parsed as User;
 }`,
            reward: { type: "milestone", score: 0.5, label: "代码修复里程碑", rubric: [
              { ok: true, text: "修复了根因（添加空值检查）" },
              { ok: true, text: "使用了正确的 apply_patch 工具" },
              { ok: true, text: "修复逻辑合理（throw 而非 return null）" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "运行测试 (第1次)",
            desc: "运行测试套件验证修复是否生效。",
            inputSummary: "history: [补丁应用结果]\ntool: exec_command(npm test)",
            outputSummary: "function_call: exec_command(['npm','test','--','user.test'])",
            developerContent: `# Codex Default Mode`,
            userContent: `parseUser 传入空字符串时会 crash，请修复...`,
            historyContent: `...
[apply_patch] Patch applied successfully.`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test", "--", "src/auth/__tests__/user.test.ts"] }`,
              stdout: `FAIL src/auth/__tests__/user.test.ts
  ✓ parses valid JSON (12ms)
  ✗ handles empty input (5ms)
    Expected: Error("parseUser: input cannot be empty")
    Received: Error("Unexpected token u in JSON at position 0")

Tests: 1 failed, 1 passed`,
              stderr: "",
              exitCode: 1,
              status: "error",
            },
            diff: null,
            reward: { type: "negative", score: -0.2, label: "测试失败！", rubric: [
              { ok: false, text: "测试未通过（1 failed）" },
              { ok: null,  text: "但失败信息提示了原因" },
            ]},
            quiz: {
              question: "💡 测试失败了！下一步 Agent 应该怎么做？",
              options: ["A. 直接再改代码", "B. 先看日志找原因", "C. 告诉用户失败了"],
              correctIndex: 1,
              answer: "Agent 选择了 B：仔细看报错日志。报错显示 'Unexpected token u in JSON at position 0'，说明空字符串 '' 传给 JSON.parse 时出错了——因为 '' 的 trim 结果也是 ''，但测试传入的可能是 undefined/null，需要再检查测试文件确认。",
            },
          },
          {
            type: "OBSERVE",
            title: "分析失败原因",
            desc: "查看测试文件，发现测试传入的是 `null` 而非空字符串，修复逻辑需要兼容 null。",
            inputSummary: "history: [测试失败输出]\ntool: cat 测试文件",
            outputSummary: "观察：测试传入 null，当前检查只覆盖了空字符串",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `...
[function_call_output] FAIL ... Expected Error("parseUser: input cannot be empty")...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["cat", "src/auth/__tests__/user.test.ts"] }`,
              stdout: `test('handles empty input', () => {
  expect(() => parseUser(null as any)).toThrow('parseUser: input cannot be empty');
  expect(() => parseUser('')).toThrow('parseUser: input cannot be empty');
  expect(() => parseUser('   ')).toThrow('parseUser: input cannot be empty');
});`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "step", score: 0.2, label: "观察到根因", rubric: [
              { ok: true, text: "正确识别：测试传入了 null" },
              { ok: true, text: "观察到还需覆盖空白字符串" },
            ]},
            quiz: null,
          },
          {
            type: "EDIT",
            title: "修复 null 兼容性",
            desc: "更新修复代码，同时处理 `null`、空字符串、纯空白字符串三种情况。",
            inputSummary: "history: [测试代码]\ntool: apply_patch",
            outputSummary: "apply_patch: 添加 null 检查",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `...
[Observed] 测试传入了 null，需要同时处理 null 和空白字符串`,
            toolIO: {
              name: "apply_patch",
              args: `*** Update File: src/auth/user.ts
@@ export function parseUser(raw: string): User {
-  if (!raw || raw.trim() === '') {
+  if (raw == null || raw.trim() === '') {`,
              stdout: "Patch applied successfully.",
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: `diff --git a/src/auth/user.ts b/src/auth/user.ts
@@ export function parseUser(raw: string): User {
-  if (!raw || raw.trim() === '') {
+  if (raw == null || raw.trim() === '') {`,
            reward: { type: "step", score: 0.3, label: "二次修复", rubric: [
              { ok: true, text: "修复了 null 检查逻辑" },
              { ok: true, text: "使用 == null 同时覆盖 null 和 undefined" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "运行测试 (第2次，通过✅)",
            desc: "重新运行测试，这次所有测试通过。",
            inputSummary: "history: [二次修复]\ntool: npm test",
            outputSummary: "测试全部通过 ✅",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `...
[apply_patch] Patch applied - null check fixed`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test", "--", "src/auth/__tests__/user.test.ts"] }`,
              stdout: `PASS src/auth/__tests__/user.test.ts
  ✓ parses valid JSON (11ms)
  ✓ handles empty input (4ms)
  ✓ handles whitespace-only input (3ms)

Tests: 3 passed, 3 total
Time: 1.2s`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "milestone", score: 1.0, label: "测试全部通过！Turn 验收", rubric: [
              { ok: true, text: "3/3 测试通过" },
              { ok: true, text: "修复了 null/empty/whitespace 三种情况" },
              { ok: true, text: "使用了「失败→观察→修复→重测」的正确策略" },
            ]},
            quiz: null,
          },
        ]
      },
      {
        id: "turn-3",
        label: "Turn 3",
        goal: "做回归验证，确认没有引入副作用",
        status: "✅",
        stepCount: 3,
        hasModeSwitch: false,
        steps: [
          {
            type: "PLAN",
            title: "制定回归验证范围",
            desc: "用户希望继续确认修复没有影响其它用例，Agent 先规划回归测试范围。",
            inputSummary: "history: [Turn1+Turn2]\nuser: '再做一轮回归验证'",
            outputSummary: "update_plan: [运行 auth 相关测试, 检查 parseUser 调用点]",
            developerContent: `# Codex Default Mode
collaboration_mode: default
approval_policy: on-failure`,
            userContent: `修复通过后，再帮我做一轮回归验证，确认没有引入副作用`,
            historyContent: `[Turn 1 完整记录]
[Turn 2 完整记录]
[user] 修复通过后，再帮我做一轮回归验证...`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: 0.2, label: "回归计划", rubric: [
              { ok: true, text: "识别到需要扩大验证范围" },
              { ok: true, text: "优先选择 auth 相关测试做回归" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "运行 auth 回归测试",
            desc: "执行 auth 模块测试，验证 parseUser 修复对周边逻辑无副作用。",
            inputSummary: "history: [回归计划]\ntool: npm test(auth suite)",
            outputSummary: "function_call_output: auth 相关测试全部通过",
            developerContent: `# Codex Default Mode`,
            userContent: `修复通过后，再帮我做一轮回归验证，确认没有引入副作用`,
            historyContent: `...
[assistant] 我先运行 auth 相关测试进行回归验证...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test", "--", "src/auth"] }`,
              stdout: `PASS src/auth/__tests__/user.test.ts
PASS src/auth/__tests__/token.test.ts
PASS src/auth/__tests__/session.test.ts

Tests: 12 passed, 12 total`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "milestone", score: 0.6, label: "回归测试通过", rubric: [
              { ok: true, text: "auth 相关测试全部通过" },
              { ok: true, text: "未观察到新增失败" },
            ]},
            quiz: null,
          },
          {
            type: "ANSWER",
            title: "反馈回归验证结果",
            desc: "将回归结论同步给用户，说明修复稳定可用。",
            inputSummary: "history: [回归测试输出]",
            outputSummary: "message: '回归测试全部通过，未发现副作用'",
            developerContent: `# Codex Default Mode`,
            userContent: `修复通过后，再帮我做一轮回归验证，确认没有引入副作用`,
            historyContent: `...
[function_call_output] auth tests passed (12/12)`,
            toolIO: null,
            diff: null,
            reward: { type: "turn", score: 0.9, label: "Turn 3 回归验收", rubric: [
              { ok: true, text: "给出了明确的回归结果结论" },
              { ok: true, text: "结果可直接用于发布判断" },
            ]},
            quiz: null,
          },
        ]
      }
    ]
  },

  // =====================================================================
  // THREAD 1: 添加新功能 (演示多步工具链+diff)
  // =====================================================================
  {
    id: "thread-def456",
    title: "任务 B：添加新功能",
    description: "用户要求给 API 添加 `/health` 端点，Agent 按计划完成了路由注册、实现、测试三步工作。",
    mode: "Default",
    model: "gpt-4.1-codex",
    turns: [
      {
        id: "turn-1",
        label: "Turn 1",
        goal: "添加 /health 端点",
        status: "✅",
        stepCount: 5,
        hasModeSwitch: false,
        steps: [
          {
            type: "PLAN",
            title: "规划实现方案",
            desc: "Agent 理解需求后，拆解为5步：探索结构 → 路由注册 → 实现 handler → 写测试 → 运行验证。",
            inputSummary: "user: '添加 /health 端点'\nturn_context: mode=default",
            outputSummary: "update_plan: [探索结构, 注册路由, 实现handler, 写测试, 运行]",
            developerContent: `# Codex Default Mode\ncollaboration_mode: default`,
            userContent: `请给 Express API 服务器添加一个 /health 端点，返回 {"status":"ok","timestamp":...}`,
            historyContent: `[新会话 - 无历史]`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: 0.1, label: "PLAN", rubric: [
              { ok: true, text: "合理拆解了多步任务" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "探索项目结构",
            desc: "查看项目文件结构，找到路由和入口文件位置。",
            inputSummary: "history: [PLAN]\ntool: exec_command(ls)",
            outputSummary: "找到 src/routes/ 目录，src/app.ts 入口",
            developerContent: `# Codex Default Mode`,
            userContent: `请给 Express API 服务器添加一个 /health 端点...`,
            historyContent: `[PLAN] 探索→路由→handler→测试→验证`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["find", "src", "-name", "*.ts", "-not", "-path", "*/node_modules/*"] }`,
              stdout: `src/app.ts
src/routes/index.ts
src/routes/users.ts
src/middleware/auth.ts
src/__tests__/routes.test.ts`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "step", score: 0.15, label: "探索结构", rubric: [
              { ok: true, text: "找到了路由目录和主入口" },
            ]},
            quiz: null,
          },
          {
            type: "EDIT",
            title: "新建 health 路由",
            desc: "在 `src/routes/health.ts` 创建新的路由 handler。",
            inputSummary: "history: [文件结构]\ntool: apply_patch(新建文件)",
            outputSummary: "apply_patch: 创建 src/routes/health.ts",
            developerContent: `# Codex Default Mode`,
            userContent: `请给 Express API 服务器添加一个 /health 端点...`,
            historyContent: `...
[探索] src/routes/ 目录下有 index.ts, users.ts`,
            toolIO: {
              name: "apply_patch",
              args: `*** Begin Patch
*** Add File: src/routes/health.ts
+import { Router } from 'express';
+
+const router = Router();
+
+router.get('/health', (_req, res) => {
+  res.json({ status: 'ok', timestamp: new Date().toISOString() });
+});
+
+export default router;
*** End Patch`,
              stdout: "Patch applied successfully.",
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: `diff --git a/src/routes/health.ts b/src/routes/health.ts
new file mode 100644
--- /dev/null
+++ b/src/routes/health.ts
@@ -0,0 +1,9 @@
+import { Router } from 'express';
+
+const router = Router();
+
+router.get('/health', (_req, res) => {
+  res.json({ status: 'ok', timestamp: new Date().toISOString() });
+});
+
+export default router;`,
            reward: { type: "milestone", score: 0.5, label: "核心实现完成", rubric: [
              { ok: true, text: "正确创建了新路由文件" },
              { ok: true, text: "响应结构符合用户要求" },
            ]},
            quiz: null,
          },
          {
            type: "EDIT",
            title: "注册路由到 app",
            desc: "修改 `src/routes/index.ts`，将 health 路由注册到主应用。",
            inputSummary: "history: [新文件创建]\ntool: apply_patch(修改index.ts)",
            outputSummary: "apply_patch: 注册 /health 路由",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `...`,
            toolIO: {
              name: "apply_patch",
              args: `*** Update File: src/routes/index.ts
@@ import usersRouter from './users';
+import healthRouter from './health';
@@ router.use('/users', usersRouter);
+router.use('/', healthRouter);`,
              stdout: "Patch applied.",
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: `diff --git a/src/routes/index.ts b/src/routes/index.ts
@@ -1,5 +1,7 @@
 import { Router } from 'express';
 import usersRouter from './users';
+import healthRouter from './health';
 
 router.use('/users', usersRouter);
+router.use('/', healthRouter);`,
            reward: { type: "step", score: 0.3, label: "路由注册", rubric: [
              { ok: true, text: "正确完成了路由注册" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "运行测试验证",
            desc: "运行测试，服务器启动验证 `/health` 端点正常工作。",
            inputSummary: "history: [两个编辑操作]\ntool: npm test",
            outputSummary: "PASS - 端点正常响应",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test", "--", "routes.test.ts"] }`,
              stdout: `PASS src/__tests__/routes.test.ts
  ✓ GET /health returns 200 (18ms)
  ✓ GET /health returns status:ok (12ms)
  ✓ GET /health returns timestamp (9ms)

Tests: 3 passed`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "turn", score: 0.95, label: "Turn 完成 - 高分", rubric: [
              { ok: true, text: "3/3 测试通过" },
              { ok: true, text: "实现了正确的响应结构" },
              { ok: true, text: "步骤精简，无冗余" },
              { ok: true, text: "没有破坏已有功能" },
            ]},
            quiz: null,
          },
        ]
      }
    ]
  },

  // =====================================================================
  // THREAD 2: 模式切换 (演示 Default → Plan 模式切换)
  // =====================================================================
  {
    id: "thread-ghi789",
    title: "任务 C：模式切换演示",
    description: "演示用户把 Codex 从 Default 模式切换到 Plan 模式的完整过程：session state 先更新，下一次 Turn 到来时，developer 层追加新的 collaboration mode 指令。",
    mode: "Default → Plan",
    model: "gpt-4.1-codex",
    turns: [
      {
        id: "turn-1",
        label: "Turn 1 (Default)",
        goal: "查询当前 server 配置",
        status: "✅",
        stepCount: 2,
        hasModeSwitch: false,
        steps: [
          {
            type: "TOOL_CALL",
            title: "查看配置文件",
            desc: "Default 模式下，Agent 直接执行，无需先输出计划。",
            inputSummary: "developer: Default模式指令\nuser: 查看 server 配置",
            outputSummary: "exec_command: cat server.config.ts",
            developerContent: `# Codex Default Mode (collaboration_mode: default)
在 Default 模式下：
- 优先直接执行，不需要先输出详细计划
- 完成任务后简要报告结果
- 只在必要时才询问确认

► collaboration_mode: default
► sandbox_policy: network-disabled`,
            userContent: `查看一下当前的 server 配置`,
            historyContent: `[新 Thread - 第一条消息]`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["cat", "server.config.ts"] }`,
              stdout: `export const serverConfig = {
  port: 3000,
  host: 'localhost',
  timeout: 30000,
  maxConnections: 100,
};`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "step", score: 0.4, label: "执行效率高", rubric: [
              { ok: true, text: "直接执行，无多余步骤" },
              { ok: true, text: "Default 模式下行为正确" },
            ]},
            quiz: null,
          },
          {
            type: "ANSWER",
            title: "回复配置信息",
            desc: "简洁报告配置内容，符合 Default 模式的简洁风格。",
            inputSummary: "history: [cat结果]",
            outputSummary: "message: 配置总结（port:3000, host:localhost...）",
            developerContent: `# Codex Default Mode (collaboration_mode: default)`,
            userContent: `查看一下当前的 server 配置`,
            historyContent: `[exec_command] cat server.config.ts
[output] port:3000, host:localhost...`,
            toolIO: null,
            diff: null,
            reward: { type: "turn", score: 0.8, label: "Turn 完成", rubric: [
              { ok: true, text: "答复简洁准确" },
            ]},
            quiz: null,
          },
        ]
      },
      {
        id: "turn-2",
        label: "Turn 2 ⚡ 模式切换",
        goal: "[用户切换到 Plan 模式] - Session State 更新",
        status: "⚙️",
        stepCount: 1,
        hasModeSwitch: true,
        steps: [
          {
            type: "OBSERVE",
            title: "⚡ 用户切换模式 → Plan",
            desc: "用户在 TUI 中切换了 collaboration mode。Codex 先更新 session state，但尚未发出新的 Turn 请求。此刻 rollout 日志不会立即有新的 developer 消息。",
            inputSummary: "UI事件: collaboration_mode = plan\n(不是新的模型请求!)",
            outputSummary: "session_state.collaboration_mode = 'plan'\n(下次 Turn 才会注入到 prompt)",
            developerContent: `// 此时 Developer 层还没有变化
// session state 已更新，但尚未注入 new turn

collaboration_mode: default  ← 上一次 turn 的
↓
[session state 内部已更新为: plan]
↓ 
[等待下一次用户消息触发注入]`,
            userContent: `[用户在 UI 中点击了「Plan 模式」切换按钮]`,
            historyContent: `[Turn 1 完整记录]`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: 0, label: "配置变更（不影响 RL 轨迹）", rubric: [
              { ok: null, text: "这不是模型决策，是 session 配置变更" },
              { ok: null, text: "RL 不直接奖罚此操作" },
            ]},
            quiz: {
              question: "💡 模式切换发生时，Codex 里立即发生了什么？",
              options: [
                "A. 立刻把 developer prompt 替换为 Plan 模式指令",
                "B. 只更新 session state，下次 Turn 才注入到 prompt",
                "C. 发送一条新的 API 请求告知模型"
              ],
              correctIndex: 1,
              answer: "Codex 选择了 B！切换时只更新内部 session_state.collaboration_mode，不立刻覆盖 developer prompt。等到用户下次真正发消息（新 Turn 开始），系统比较前后 mode 差异，才追加一条新的 developer ResponseItem。这就是 append-only 策略的体现。",
            },
          },
        ]
      },
      {
        id: "turn-3",
        label: "Turn 3 (Plan 模式生效)",
        goal: "重构 server 配置（Plan 模式下先规划再执行）",
        status: "✅",
        stepCount: 4,
        hasModeSwitch: false,
        steps: [
          {
            type: "PLAN",
            title: "输出详细计划（Plan 模式特征）",
            desc: "新 Turn 到来！Codex 比较 mode 差异，在 developer 层追加 Plan 模式指令。现在 Agent 必须先输出详细计划，获得确认后才执行。",
            inputSummary: "developer[旧]: Default 模式指令\ndeveloper[新追加]: Plan 模式指令\nuser: 重构 server 配置",
            outputSummary: "update_plan: 详细的5步重构计划",
            developerContent: `# Codex Default Mode  ← 旧的（仍在 history 里）
...

# ⬇ Plan Mode Update (append-only 追加)
collaboration_mode: plan
在 Plan 模式下：
- 必须先输出完整计划再执行任何操作
- 不能直接修改文件——先得到用户确认
- 每个重要步骤前询问确认
- 只输出计划，不直接执行破坏性操作

► 当前 active mode: PLAN (覆盖旧的 Default 指令)`,
            userContent: `帮我重构 server.config.ts，把配置分离到 env 变量`,
            historyContent: `[Turn 1, Turn 2 历史]
[user] 帮我重构 server.config.ts...`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: 0.3, label: "Plan 模式行为正确", rubric: [
              { ok: true, text: "正确识别 Plan 模式，先输出计划" },
              { ok: true, text: "developer 层追加了新的 mode update" },
              { ok: true, text: "没有直接执行修改（符合 Plan 模式规则）" },
            ]},
            quiz: null,
          },
          {
            type: "OBSERVE",
            title: "等待用户确认",
            desc: "Plan 模式下，Agent 输出计划后暂停，等待用户确认才执行。注意与 Default 模式的对比！",
            inputSummary: "history: [PLAN 输出]",
            outputSummary: "message: '计划已准备好，是否执行？'",
            developerContent: `# Plan Mode: collaboration_mode = plan`,
            userContent: `...`,
            historyContent: `[PLAN] 1.读配置 2.创建.env 3.修改代码 4.测试`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: 0.2, label: "等待确认（Plan 模式正确行为）", rubric: [
              { ok: true, text: "Plan 模式下正确暂停等待" },
              { ok: true, text: "Default 模式下会直接执行（对比）" },
            ]},
            quiz: null,
          },
          {
            type: "EDIT",
            title: "用户确认后执行修改",
            desc: "用户确认计划后，Agent 开始执行。创建 `.env` 文件并修改 `server.config.ts`。",
            inputSummary: "user: '确认执行'\nhistory: [PLAN, 等待]",
            outputSummary: "apply_patch: 创建 .env + 修改 config",
            developerContent: `# Plan Mode: 用户已确认`,
            userContent: `好的，按计划执行`,
            historyContent: `...
[user] 好的，按计划执行`,
            toolIO: {
              name: "apply_patch",
              args: `*** Add File: .env.example
+PORT=3000
+HOST=localhost
+TIMEOUT=30000
+MAX_CONNECTIONS=100

*** Update File: server.config.ts
-export const serverConfig = {
-  port: 3000,
-  host: 'localhost',
-  timeout: 30000,
-  maxConnections: 100,
-};
+export const serverConfig = {
+  port: Number(process.env.PORT) || 3000,
+  host: process.env.HOST || 'localhost',
+  timeout: Number(process.env.TIMEOUT) || 30000,
+  maxConnections: Number(process.env.MAX_CONNECTIONS) || 100,
+};`,
              stdout: "Patch applied successfully.",
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: `diff --git a/server.config.ts b/server.config.ts
@@ -1,6 +1,6 @@
 export const serverConfig = {
-  port: 3000,
-  host: 'localhost',
-  timeout: 30000,
-  maxConnections: 100,
+  port: Number(process.env.PORT) || 3000,
+  host: process.env.HOST || 'localhost',
+  timeout: Number(process.env.TIMEOUT) || 30000,
+  maxConnections: Number(process.env.MAX_CONNECTIONS) || 100,
 };`,
            reward: { type: "milestone", score: 0.6, label: "重构里程碑", rubric: [
              { ok: true, text: "创建了 .env.example 文件" },
              { ok: true, text: "配置正确从环境变量读取" },
              { ok: true, text: "保留了合理的默认值" },
            ]},
            quiz: null,
          },
          {
            type: "ANSWER",
            title: "报告完成（附 Plan 模式说明）",
            desc: "Plan 模式下的最终答复更为详细，会说明完成了哪些步骤。",
            inputSummary: "history: [执行结果]",
            outputSummary: "Turn 完成，详细报告执行结果",
            developerContent: `# Plan Mode`,
            userContent: `...`,
            historyContent: `...
[apply_patch] server.config.ts 重构完成`,
            toolIO: null,
            diff: null,
            reward: { type: "turn", score: 0.9, label: "Turn 完成（Plan 模式）", rubric: [
              { ok: true, text: "完成了用户要求的配置重构" },
              { ok: true, text: "Plan 模式下先规划再执行" },
              { ok: true, text: "append-only 方式注入了新 mode 指令" },
            ]},
            quiz: null,
          },
        ]
      }
    ]
  },

  // =====================================================================
  // THREAD 3: 坏轨迹反例 (演示无效循环与负奖励累积)
  // =====================================================================
  {
    id: "thread-bad999",
    title: "任务 D：坏轨迹（反例）",
    description: "演示一个低质量轨迹：重复调用、无效工具选择、缺少关键观察，导致负奖励累积与 Turn 失败。",
    mode: "Default",
    model: "gpt-4.1-codex",
    turns: [
      {
        id: "turn-1",
        label: "Turn 1",
        goal: "定位 parseUser 空值 bug（失败轨迹）",
        status: "⚠️",
        stepCount: 6,
        hasModeSwitch: false,
        steps: [
          {
            type: "PLAN",
            title: "计划过于粗糙",
            desc: "没有拆分关键验证步骤，只给出笼统计划。",
            inputSummary: "user: 修复 parseUser 空值问题",
            outputSummary: "update_plan: 修复并测试",
            developerContent: `# Codex Default Mode
collaboration_mode: default
approval_policy: on-failure`,
            userContent: `parseUser 传入空值会 crash，帮我修复并验证`,
            historyContent: `[新线程]`,
            toolIO: null,
            diff: null,
            reward: { type: "step", score: -0.1, label: "计划质量低", rubric: [
              { ok: false, text: "未明确关键观察路径" },
              { ok: false, text: "缺少失败恢复策略" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "错误工具选择（先跑全量测试）",
            desc: "在未读代码前直接跑全量测试，信号噪声很大。",
            inputSummary: "history: [粗糙计划]\ntool: npm test",
            outputSummary: "function_call: exec_command(['npm','test'])",
            developerContent: `# Codex Default Mode`,
            userContent: `parseUser 传入空值会 crash，帮我修复并验证`,
            historyContent: `[assistant] 先跑一下全部测试...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test"] }`,
              stdout: `FAIL multiple suites ...\n(噪声很高，未聚焦 parseUser)`,
              stderr: "",
              exitCode: 1,
              status: "error",
            },
            diff: null,
            reward: { type: "negative", score: -0.4, label: "无效调用", rubric: [
              { ok: false, text: "未聚焦问题域，浪费调用" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "重复同样无效调用",
            desc: "再次执行同类无效操作，没有先做观察收敛。",
            inputSummary: "history: [全量测试失败]\ntool: npm test",
            outputSummary: "function_call: exec_command(['npm','test']) again",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `[assistant] 再跑一次看看...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test"] }`,
              stdout: `FAIL same suites ...`,
              stderr: "",
              exitCode: 1,
              status: "error",
            },
            diff: null,
            reward: { type: "negative", score: -0.6, label: "重复无效动作", rubric: [
              { ok: false, text: "重复调用，未新增信息增益" },
            ]},
            quiz: null,
          },
          {
            type: "EDIT",
            title: "盲改代码（未读上下文）",
            desc: "未读取目标文件直接修改，导致修复不完整。",
            inputSummary: "history: [连续失败]\ntool: apply_patch",
            outputSummary: "apply_patch: 添加不完整检查",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `[assistant] 我先直接改一下...`,
            toolIO: {
              name: "apply_patch",
              args: `*** Update File: src/auth/user.ts\n@@\n- return JSON.parse(raw)\n+ if (!raw) throw new Error('bad input')\n+ return JSON.parse(raw)`,
              stdout: "Patch applied successfully.",
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: `diff --git a/src/auth/user.ts b/src/auth/user.ts\n@@\n- return JSON.parse(raw)\n+ if (!raw) throw new Error('bad input')\n+ return JSON.parse(raw)`,
            reward: { type: "negative", score: -0.3, label: "盲改风险", rubric: [
              { ok: false, text: "修复未覆盖 whitespace/null 关键场景" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "测试仍失败",
            desc: "修复未覆盖关键输入，测试继续失败。",
            inputSummary: "history: [盲改后]\ntool: targeted test",
            outputSummary: "test failed: null/whitespace case",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `[assistant] 运行目标测试...`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test", "--", "src/auth/__tests__/user.test.ts"] }`,
              stdout: `FAIL user.test.ts\n✗ handles null input\n✗ handles whitespace input`,
              stderr: "",
              exitCode: 1,
              status: "error",
            },
            diff: null,
            reward: { type: "negative", score: -0.5, label: "结果退化", rubric: [
              { ok: false, text: "关键测试仍失败" },
            ]},
            quiz: null,
          },
          {
            type: "ANSWER",
            title: "Turn 失败收束",
            desc: "未能在本轮内解决问题，只能返回失败状态。",
            inputSummary: "history: [失败链路]",
            outputSummary: "message: 当前修复未通过，需重新分析",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `[assistant] 当前修复未通过，建议重新定位根因`,
            toolIO: null,
            diff: null,
            reward: { type: "turn", score: -0.8, label: "Turn 失败", rubric: [
              { ok: false, text: "未达成用户目标" },
              { ok: false, text: "出现重复无效步骤" },
            ]},
            quiz: null,
          },
        ]
      },
      {
        id: "turn-2",
        label: "Turn 2",
        goal: "重新分析后再修复（恢复轨迹）",
        status: "✅",
        stepCount: 4,
        hasModeSwitch: false,
        steps: [
          {
            type: "OBSERVE",
            title: "先读测试再读源码",
            desc: "恢复策略：先观察失败样例，再定位源码。",
            inputSummary: "history: [Turn1失败]\ntool: cat tests + source",
            outputSummary: "观察到 null/whitespace 未覆盖",
            developerContent: `# Codex Default Mode`,
            userContent: `继续修复，先分析再改`,
            historyContent: `[Turn1 完整失败记录]\n[user] 继续修复，先分析再改`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["cat", "src/auth/__tests__/user.test.ts"] }`,
              stdout: `expect(() => parseUser(null as any)).toThrow(...)\nexpect(() => parseUser('   ')).toThrow(...)`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "step", score: 0.4, label: "恢复到观察驱动", rubric: [
              { ok: true, text: "先观察后修改，路径正确" },
            ]},
            quiz: null,
          },
          {
            type: "EDIT",
            title: "补全边界修复",
            desc: "覆盖 null/empty/whitespace 三种输入。",
            inputSummary: "history: [观察结果]\ntool: apply_patch",
            outputSummary: "patch: raw == null || raw.trim()==''",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `[assistant] 已识别遗漏边界，开始补全修复`,
            toolIO: {
              name: "apply_patch",
              args: `*** Update File: src/auth/user.ts\n@@\n- if (!raw) throw new Error('bad input')\n+ if (raw == null || raw.trim() === '') throw new Error('parseUser: input cannot be empty')`,
              stdout: "Patch applied successfully.",
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: `diff --git a/src/auth/user.ts b/src/auth/user.ts\n@@\n- if (!raw) throw new Error('bad input')\n+ if (raw == null || raw.trim() === '') throw new Error('parseUser: input cannot be empty')`,
            reward: { type: "milestone", score: 0.7, label: "修复路径纠正", rubric: [
              { ok: true, text: "覆盖关键边界条件" },
            ]},
            quiz: null,
          },
          {
            type: "TOOL_CALL",
            title: "回归测试通过",
            desc: "目标测试全部通过。",
            inputSummary: "history: [补全修复]\ntool: npm test targeted",
            outputSummary: "PASS user.test.ts",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `[assistant] 运行目标测试验证`,
            toolIO: {
              name: "exec_command",
              args: `{ "command": ["npm", "test", "--", "src/auth/__tests__/user.test.ts"] }`,
              stdout: `PASS user.test.ts\n✓ null\n✓ empty\n✓ whitespace`,
              stderr: "",
              exitCode: 0,
              status: "ok",
            },
            diff: null,
            reward: { type: "step", score: 0.6, label: "验证通过", rubric: [
              { ok: true, text: "目标测试全部通过" },
            ]},
            quiz: null,
          },
          {
            type: "ANSWER",
            title: "恢复完成",
            desc: "报告修复成功并总结失败轨迹教训。",
            inputSummary: "history: [测试通过]",
            outputSummary: "message: 修复完成 + 教训总结",
            developerContent: `# Codex Default Mode`,
            userContent: `...`,
            historyContent: `[assistant] 修复完成，后续建议：先观察后修改，避免重复无效调用`,
            toolIO: null,
            diff: null,
            reward: { type: "turn", score: 0.8, label: "Turn 恢复成功", rubric: [
              { ok: true, text: "完成目标并给出改进建议" },
            ]},
            quiz: null,
          },
        ]
      }
    ]
  }
];

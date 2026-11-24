# utilies

多技术栈实验工具集目录：含 `AgentSafePay/`（Monad 会话密钥支付策略服务）、`shake-detectorapp/`（Expo SDK 54 摇一摇检测 App）与 `douni/`（跨端摇动检测骨架）。

## 用途与 Target 判定

| 平台 | 需要? | 方式 |
|------|-------|------|
| 移动端 | 可选 | 子工程 `shake-detectorapp/` 采用 Expo RN；目录整体按子包独立演进 |
| 智能硬件 | 可选 | 加速度计摇动检测位于子包内，外设穿戴可选搁置 |

## 命令

```bash
cd AgentSafePay && npm install && npm test
cd ../shake-detectorapp && npm install && npm test
```

## Harness / Loop（助手）

- 遵循根 `/Users/skat/AGENTS.md` Harness + Loop 规则
- Guide = 本文件；Sensor = 各子工程自带单测（`AgentSafePay/test/`、`shake-detectorapp/__tests__/`）
- 子工程保持边界独立；若单子包升级为主产品应迁出为独立 active 工程

## 验证环 / Done

```bash
cd AgentSafePay && npm test
cd ../shake-detectorapp && npm test
```

**Done 示例**：所改子工程的单元测试与类型检查全绿，不污染同目录其它子工程。

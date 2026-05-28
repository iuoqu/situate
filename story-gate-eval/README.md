# story-gate-eval

把"故事门神"叙事结构判定的 RUBRIC 当作可调参数、specimens 当作测试集的提示词
迭代工具。对每篇散文：抽骨架（S0/D/T/S1/K）→ 跑门神三谓词 → 识别引擎 → 跑诊断
子。最终是 Situate Editions /submit 表单的"边写边诊断"侧栏的底座。

## 两种调用模式

### 推荐：远端 HTTP 模式（避免本地持有 API key）

部署 situate 主项目里的 `/api/diagnose` 端点（见 Phase 2），把 RUBRIC 移到 TS 端，
本工具变成 HTTP 客户端：

```bash
export ANALYZER_URL=http://localhost:3000/api/diagnose  # 或 https://...vercel.app/...
export ANALYZER_TOKEN=...                                # 鉴权 bearer-token（可选）
pip install -r requirements.txt
python run_eval.py
```

### 兼容：直连 Anthropic SDK 模式（沙盒）

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pip install -r requirements.txt
python run_eval.py
```

`ANALYZER_URL` 优先于 `ANTHROPIC_API_KEY`。两个都没设，工具不会崩，会按 ERR 落表，
方便先看走查流程是不是通的。

## 输出

- `results/<flat_name>.json` —— 每篇一个，模型推理结果（gate.why、borderline_note
  等是迭代 RUBRIC 时最有价值的信号）
- 汇总表分三组：**train**（看个案、为之改 RUBRIC）/ **holdout**（只看总分、不为之
  改 RUBRIC，防过拟合）/ **partial**（草稿，走 `analyze_partial` RUBRIC）
- 末尾会自动报"train 比 holdout 高 X%"，超 15% 提示可能过拟合

## 样本布局

```
specimens/
├── synthetic/
│   ├── faqtiao/   6 篇  同题材"发条"× 6 种结构变形（mood/revelation/conflict/inevitability/description/process）
│   ├── phone/     4 篇  同题材"母亲的电话"× 4 种
│   ├── tea/       4 篇  同题材"茶"× 4 种
│   ├── journey/   4 篇  同题材"雨夜回家"× 4 种
│   ├── canonical_style/  5 篇  契诃夫式/海明威式/中国笔记小说/网文/zuihitsu 仿写
│   └── english/   5 篇  英文，跨语言一致性测试
├── edge/          5 篇  散文诗/意识流/纪实/纯对话/50字微小说——边界、应低 confidence
└── partial/       3 篇  完整版的 30%/60%/80% 切片，测部分草稿宽容度
```

**Holdout**（不参与 RUBRIC 调参，只用于最终验收）：用 `holdout: true` 标在
`expectations.json` 里。目前 8 篇——契诃夫式、海明威式、跨题材稳定性测试各占一份。

## 期望 schema

`expectations.json` 每条覆盖一篇 specimen，键是相对 `specimens/` 的路径。字段：

| 字段 | 含义 |
|---|---|
| `is_story` | bool，故事/非故事 |
| `type` | 失败类型 `描摹` / `随笔` / `说明` / `null`（is_story=true 时为 null） |
| `expected_engine` | 期望主引擎 conflict/recontextualize/revelation/inevitability/null |
| `confidence_band` | `[min, max]` 期望 confidence 区间，超出范围算 FAIL |
| `tradition` | 传统标签，分布审计用 |
| `purpose` | 一句话写清楚这篇 specimen 在测什么 |
| `holdout` | true 表示不参与提示词迭代 |
| `is_partial` + `partial_expectations` | 草稿专用，标 S0/D/T/S1 各轴期望状态 |

## 添加更多样本

每加一篇：
1. `.txt` 丢进合适的子目录（同题材就归到 synthetic/<series>/）
2. 在 `expectations.json` 加一条
3. 重跑 `python run_eval.py`

**用 Claude 自己作为放大器**：要把样本量从几十扩到几百，可以让 Claude 基于一个种子
specimen 产新变体（"把这篇改成 inevitability 引擎而不是 revelation"），人工审后入库。
这条管线（`generate_variations.py`）会在 Phase 3 实现，但接口已经预留了。

## RUBRIC 在哪里改

- 完整稿 RUBRIC：`analyze.py` 里的 `RUBRIC_FULL`
- 草稿 RUBRIC：`analyze.py` 里的 `RUBRIC_PARTIAL`（观察口气、明确允许各轴缺位、
  禁止补编未写出的部分）

Phase 2 之后，权威 RUBRIC 会移到 situate 项目 `src/lib/skeleton-diagnostic/rubric.ts`，
Python 这边会只是它的 fallback。

## 失败模式分类

- **PASS** —— 该 specimen 在 is_story / type / engine / confidence 四个维度全对
- **FAIL[is_story]** —— 故事/非故事判错
- **FAIL[type(X≠Y)]** —— 非故事类型判错
- **FAIL[engine(X≠Y)]** —— 引擎主权重判错
- **FAIL[conf(X∉[lo,hi])]** —— confidence 超出期望区间（往往说明 RUBRIC 太自信或
  太怯）
- **ERR** —— API 调用失败 / JSON 解析失败 / 没设 key

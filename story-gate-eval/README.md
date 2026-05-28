# story-gate-eval

把"故事门神"叙事结构判定的 RUBRIC 当作可调参数、specimens 当作测试集的提示词
迭代工具。对每篇散文：抽骨架（S0/D/T/S1/K）→ 跑门神三谓词 → 识别引擎 → 跑诊断
子。最终是 Situate Editions /submit 表单的"边写边诊断"侧栏的底座。

## 架构：所有 Claude 调用都在 Vercel 那一头

```
                ┌──────────────────────────────────┐
                │  Vercel: situate.vercel.app      │
                │  ├ ANTHROPIC_API_KEY  (env)      │
                │  └ DIAGNOSTIC_INTERNAL_TOKEN     │
                │                                  │
                │  /api/diagnose          per-text │
                │  /api/revise-rubric     meta     │
                │  /api/generate-variation 扩样本   │
                │  权威 RUBRIC 在                  │
                │  src/lib/skeleton-diagnostic/    │
                └─────────────────┬────────────────┘
                                  │ HTTP + bearer auth
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
       [run_eval.py]      [revise_rubric.py]  [generate_variations.py]
         ANALYZER_URL       ANALYZER_URL        ANALYZER_URL
         ANALYZER_TOKEN     ANALYZER_TOKEN      ANALYZER_TOKEN
         （本端不持有 ANTHROPIC_API_KEY）
```

**本端只需两个 env var**：

```bash
export ANALYZER_URL=https://situate.vercel.app        # 或 http://localhost:3000
export ANALYZER_TOKEN=<同 Vercel 上 DIAGNOSTIC_INTERNAL_TOKEN 的值>
pip install -r requirements.txt
python run_eval.py
```

ANALYZER_URL 是 base URL，三个脚本各自追加自己的 `/api/<name>` 路径。
（旧版本里写过 `/api/diagnose` 全 URL 的，会自动剥掉后缀向后兼容。）

### 沙盒模式（不走 Vercel，用本地 Anthropic key）

仅 `analyze.py / run_eval.py` 支持。`revise_rubric.py` 和 `generate_variations.py`
**只走 Vercel**——它们是 meta 工具，没有 SDK fallback。

```bash
export ANTHROPIC_API_KEY=sk-ant-...
python run_eval.py    # 跳过 Vercel，本地直连 Anthropic
```

ANALYZER_URL 优先于 ANTHROPIC_API_KEY。两个都没设，工具不会崩，会按 ERR 落表。

## 输出

- `results/<flat_name>.json` —— 每篇一个，模型推理结果（gate.why、borderline_note
  等是迭代 RUBRIC 时最有价值的信号）
- 汇总表分三组：**train**（看个案、为之改 RUBRIC）/ **holdout**（只看总分、不为之
  改 RUBRIC，防过拟合）/ **partial**（草稿模式）
- 末尾自动报"train 比 holdout 高 X%"，超 15% 提示可能过拟合

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

### 用 Claude 自己当样本生成器（generate_variations.py）

把 36 篇种子集放大到几百篇的现实路径。**只走 Vercel**：

**单次**：
```bash
python generate_variations.py \
  --seed specimens/synthetic/faqtiao/02_revelation.txt \
  --transform "把引擎改成 inevitability，保持 understanding 维度" \
  --out specimens/synthetic/faqtiao/04b_inevitability_v2.txt
```

**批量**（推荐）：JSON manifest 一次产十几篇，见 `variations.example.json`：
```bash
python generate_variations.py --manifest variations.example.json
```

每篇产物同时写出 `<out>.txt` 和 `<out>.expectation.json`，后者带
`_generated / _seed / _transform / _design_notes` 溯源字段。**人审不可省**——
review .txt 看读起来对不对，把 .expectation.json 内容合并进 expectations.json，
删 sidecar 文件，重跑 run_eval.py。

模型默认 `claude-sonnet-4-6`；加 `--strict` 切到 `claude-opus-4-7`（贵 5x、
结构更稳，做正式扩样本时用）。

### 看到结果之后让 Claude 提 RUBRIC 修改建议（revise_rubric.py）

`run_eval.py` 跑完之后，把翻车 + borderline 案例 POST 给 `/api/revise-rubric`
（opus-4-7 + adaptive thinking），拿外科式修改建议：

```bash
python revise_rubric.py             # 改 RUBRIC_FULL，默认不算 holdout（防过拟合）
python revise_rubric.py --mode partial            # 改 RUBRIC_PARTIAL
python revise_rubric.py --include-holdout         # 终验：把 holdout 也算进来
```

输出：
- 控制台：DIAGNOSIS（失败聚类 + 根因分类：rubric_wording / skeleton_model /
  confidence_calibration / expectation_wrong）+ PROPOSED EDITS（before/after
  snippet + 预计修复 + 预计破坏）+ 骨架级问题 + overall
- 文件：`revision_proposals/<mode>_<timestamp>.json` 完整 JSON，可追溯

**这个工具能解决什么、不能解决什么**：

| 能 | 不能 |
|---|---|
| RUBRIC 措辞模糊导致的误判 | 骨架本身覆盖不到某类文学（要扩 S0/D/T/S1/K 或显式 out_of_scope） |
| confidence 系统性偏高/偏低 | 模型本身能力不够（要在 TS 端换 opus-4-7） |
| 引擎描述互相重叠 | 标注本身有争议（看 skeleton_questions 字段） |

工具不会自动 apply。**人审之后两边都改**：
- `src/lib/skeleton-diagnostic/rubric.ts`（权威，部署生效）
- `story-gate-eval/analyze.py` 里 `RUBRIC_*` 副本（沙盒用，保持同步）

## RUBRIC 在哪里改

- **权威版本**：`src/lib/skeleton-diagnostic/rubric.ts`——`/api/diagnose` 服务
  这一份。改完要 redeploy（或本地 `npm run dev` 热更新）才生效。
- **Python 副本**：`analyze.py` 里的 `RUBRIC_FULL` / `RUBRIC_PARTIAL`——仅在
  沙盒模式（直连 SDK）使用，平时跟 TS 那一份保持同步即可。

## 失败模式分类

- **PASS** —— 该 specimen 在 is_story / type / engine / confidence 四个维度全对
- **FAIL[is_story]** —— 故事/非故事判错
- **FAIL[type(X≠Y)]** —— 非故事类型判错
- **FAIL[engine(X≠Y)]** —— 引擎主权重判错
- **FAIL[conf(X∉[lo,hi])]** —— confidence 超出期望区间
- **ERR** —— API 调用失败 / JSON 解析失败 / 没设 ANALYZER_URL 也没设 ANTHROPIC_API_KEY

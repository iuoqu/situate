# story-gate-eval

一个把"故事门神"叙事结构判定机制实现成可运行程序的小型 Python 评测工具。
对任意一段散文，用 Anthropic Messages API 跑一次结构化分析，返回是否是故事 /
骨架(S0/D/T/S1/K) / 实现引擎 / 诊断子，并对照 `expectations.json` 给 PASS/FAIL。

## 用法

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
python run_eval.py
```

`run_eval.py` 会：
- 遍历 `specimens/*.txt`，每篇调一次 `analyze.py::analyze()`
- 每篇结果写入 `results/<名>.json`
- 打印汇总表：文件名 / is_story / if_not_story_type / 主引擎 / confidence / 期望 / PASS|FAIL
- 末尾打印命中率

默认模型 `claude-sonnet-4-6`（在 `analyze.py` 顶部 `MODEL` 常量）。如果判断吃力
（短篇、暧昧的实验文本），换成 `claude-opus-4-7`。

## 项目结构

```
analyze.py           核心：analyze(text)->dict
run_eval.py          批量跑 specimens/，写 results/，打印汇总
specimens/           输入，每个 .txt 一篇，首行当标题
expectations.json    期望值，用于 PASS/FAIL
results/             输出每篇一个 .json
requirements.txt
README.md
```

## 添加更多样本

把新的 `.txt` 丢进 `specimens/`，在 `expectations.json` 加一行：

```json
{
  "my_new_specimen.txt": {"is_story": true, "type": null}
}
```

`type` 取 `"描摹"|"随笔"|"说明"|null`：当 `is_story=true` 时设为 `null`。
没在 `expectations.json` 里登记的样本仍会被分析，只是不计 PASS/FAIL。

## 推荐的对照集合

为了把诊断器逼出弱点，建议加入：

- **几篇契诃夫公版英译原文**（如 *The Lady with the Dog*, *Gooseberries*）——
  典型的 understanding 维度转变、无外部冲突，用来验证"传统中立"是否真的中立、
  不会被强按到 conflict 引擎里。
- **几篇故意写坏的**——把开头扰动删掉变描摹；把因果脊柱抽掉只剩联想流变随笔；
  把利害(K)抽空变说明。用来核对失败类型分类是否准确。
- **一段升级流章节**——纯 conflict 引擎、situation 维度、强因果脊柱，
  和契诃夫式的形成对照，用来验证引擎权重分得开。

## 输出 schema

见 `analyze.py` 中 `RUBRIC` 常量结尾的 JSON 模板。关键字段：

- `gate.is_story` —— bool
- `gate.if_not_story_type` —— `"描摹"|"随笔"|"说明"|null`
- `gate.confidence` —— 0.0–1.0
- `engines[]` —— `{engine, weight, why}`，weight 总和不要求归一
- `diagnostics[]` —— 四个固定 id：`causal_spine` / `the_turn` / `economy` / `flat_subtext`，
  severity ∈ `ok|note|warn|error`

## 解析失败

模型偶尔吐出带 markdown 围栏或带前言的 JSON。`analyze()` 会：

1. 去围栏后 `json.loads`
2. 失败则原样再调一次模型重试一次
3. 仍失败返回 `{"error": "...", "raw": "..."}`，不会让批处理崩

`error` 项在汇总表里会显示 `ERROR`，不计入命中率分母。

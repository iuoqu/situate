# `stakes_absent` 诊断子实验 v0

研究问题：能不能写一个稳定的 prompt，让模型识别"K（利害绑定到意识）缺失"？

## 方法

**对比组构造法** —— 8 篇 specimens 是 **4 对**，每对同题材、同事件，
只在 K 这一根轴上差。金标准**来自构造本身**，不是我的主观判断。

| 对 | 题材 | with_K 版本 | no_K 版本 |
|---|---|---|---|
| 1 | 父子（照片重逢）| 第一人称、叙事者内心、对父亲缺席的承重 | 第三人称外在记录、监控镜头视角 |
| 2 | 母女（病榻发现） | 女儿内心、对自己冷淡多年的清算 | 病房日志体、统计语言 |
| 3 | 异乡人（早市误解）| 外人内心、领悟当地人不为难自己 | 居民登记表语气、统计数据收尾 |
| 4 | 老友重逢 | 主角认出朋友的笑变了 | 行为观察记录、面部肌肉描述 |

**Strip K 的方法**（每对 no_K 版本都做了）：
- 删除第一人称 / 内心独白 / 评价性形容词
- 把事件叙述改为外在观察（"X 做了 Y"，不带"X 感到 / 想 / 认为"）
- 用统计、行政、监控、医学这类语域稀释承重感
- 添加无关的环境描述（建筑年代、人口统计、地砖材质等）

事件、人物、地点、对话**完全相同**——只是叙事承担消失。

## 三关验证（金标准就是这样炼出来的）

```
（A）构造法：写出来的时候我已经机械地把 K 拆了                    ✓ 已通过
（B）多模型共识：跑 4 家 model 看是否都识别 with_K 有/no_K 无 K     ⬜ 需要运行
（C）你手审：只接受 4/4 共识的 specimens 进生产基线                  ⬜ 等 B 完成
```

只有过完三关的才作为 `stakes_absent` 诊断子的单元测试基线。

## 文件

```
specimens/
  01_father_son_with_K.txt        K 强
  01_father_son_no_K.txt          K 拆
  02_mother_daughter_with_K.txt
  02_mother_daughter_no_K.txt
  03_stranger_with_K.txt
  03_stranger_no_K.txt
  04_old_friends_with_K.txt
  04_old_friends_no_K.txt
expectations.json                  每篇的 intended label
consensus_check.py                 跑多模型共识（你在配 key 的机器跑）
README.md                          这份文档
```

## 你接下来做的两步

**步 B**（你跑，5-10 分钟）：
```bash
cd story-gate-eval/diagnoser_experiments/stakes_absent
export ANALYZER_URL=https://situate.vercel.app    # 或本地
export ANALYZER_TOKEN=...
python consensus_check.py
```

会输出每篇 specimen 在 4 个 model 上的判定（是否 K 缺失 + confidence），
最末给出 consensus 报告：哪些 4/4 通过、哪些分裂、哪些反对我的标签。

**步 C**（你审，~20 分钟）：

我看 B 的输出，把通过的写入"生产金标准"，分裂的进 `edge/`。
通过这步的才能用来验证 `stakes_absent` v0 prompt。

## 期望

- with_K × 4：模型应一致说 **K 存在 / 不应 fire stakes_absent**
- no_K × 4：模型应一致说 **K 缺失 / 应 fire stakes_absent**
- 4/4 共识率应当 ≥ 75%（8 篇里至少 6 篇通过）
- 如果共识率低，是 specimen 写得不够清，或 K 概念本身需要再说清

## 不验证

- 不验证模型给出的 Socratic question 质量（那是诊断子 v0 之后的工作）
- 不验证模型对其他诊断子的判定（只测 stakes_absent）
- 不动现有 36 篇 specimens 的标签

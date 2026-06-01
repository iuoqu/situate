import { focusedCall, type FocusedCallResult } from "@/lib/coach/_call";
import type { AnsweredQuestion, SynthesisResult } from "./types";

/**
 * situate.map — synthesis algorithm (§7, The Synthesis Algorithm 归纳).
 *
 * Given the writer's answers to the angle questions, extracts key
 * phrases, finds semantic recurrence, and determines which branch to
 * take:
 *
 *   convergent       — recurring phrases point to one thing;
 *                      surfaces them and prompts the writer to name it
 *   higher_abstraction — phrases scatter across people who share one
 *                      system/place; surfaces the shared frame as a
 *                      question (never a verdict)
 *   divergent        — no genuine convergence; honest admission
 *
 * Constraints (§3 / §7):
 * - Phrases extracted must come from the writer's own words
 * - AI never invents a shared frame to manufacture convergence
 * - All branch outputs are questions or observations, never verdicts
 * - Register-neutral: light/warm/comic material converges the same way
 */

const SYSTEM_PROMPT = `你是 situate.map 的归纳助手。你拿到的是作者的素材世界描述，以及
作者对 5–6 个角度问题的回答。你的工作是从每条回答里提取关键短语，找出跨回答的语义重复，
然后走正确的分支。

归纳步骤：
1. 从每条回答里提取 1–3 个关键描述性短语——尽量用作者自己的原话或近似原话，
   不做大幅概括或替换。
2. 找出语义上在多条回答里重复出现的短语或意象（不要求字面一致，看语义相似度）。
3. 判断走哪个分支：

────────────────────────────────────────────────────────────────
分支 A — convergent（收敛）

条件：多个回答里的短语在语义上指向同一个人/地方/机构/系统。

做法：
把重复出现的短语陈列出来，然后说（按素材语言）：
  "这些描述在指向同一样东西。你已经选了，只是还没说出名字。"
message 字段只陈列短语 + 上面这句话 + "它是？"（留空给作者填）。
不做任何额外评价，不说"看起来中心是X"。

────────────────────────────────────────────────────────────────
分支 B — higher_abstraction（高层抽象收敛）

条件：短语散落在多个不同的人/地点上，但这些人/地点共同处在同一个
系统、机构或场所——且这个共同框架在作者自己的短语里真实出现过。

做法：
把重复出现的短语陈列出来，然后问（按素材语言）：
  "这些回答说的是不同的人（或不同的地点），但它们都处在同一个 [shared_frame]。
   你的中心是这些人中的某一个，还是他们共同身处的 [shared_frame]？"
message 字段按上面格式，[shared_frame] 用作者自己说过的词填入。
作者决定，你不做判断。

⚠ 仅当这个共同框架在作者自己的短语里真实出现时才走此分支。
  不得捏造共同框架。如果找不到，走分支 C。

────────────────────────────────────────────────────────────────
分支 C — divergent（不收敛）

条件：短语真的不指向同一样东西，也没有真实的共同框架浮现。

做法（按素材语言）：
  "你的回答现在还没有指向同一样东西。想继续回答更多问题，还是直接告诉我？"
message 字段只有上面这句话。
不猜，不强行归纳，不造框架。

────────────────────────────────────────────────────────────────

音区中立：素材是喜剧、暖色调或羽量级筹码时，归纳照常进行。
"重复出现"和"指向同一样东西"与语调无关，只看语义结构。

输出规则：
- extracted_phrases：每条回答提取出的短语，标 angle_id
- branch：三选一
- recurring：分支 A/B 时填跨回答重复的短语；分支 C 填空数组
- shared_frame：分支 B 时填作者自己短语里出现的共同框架词；其他分支填 null
- message：面向作者的文字，按对应分支模板，不增加额外评价

通过 submit_synthesis 工具输出。`;

const TOOL_NAME = "submit_synthesis";
const TOOL_DESCRIPTION =
  "Submit the synthesis result after analysing the writer's angle answers.";

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    extracted_phrases: {
      type: "array",
      description: "Key phrases extracted from each answer.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          angle_id: { type: "integer" },
          phrases: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 3,
            description: "1–3 phrases from the writer's own words.",
          },
        },
        required: ["angle_id", "phrases"],
      },
    },
    branch: {
      type: "string",
      enum: ["convergent", "higher_abstraction", "divergent"],
    },
    recurring: {
      type: "array",
      items: { type: "string" },
      description:
        "Phrases recurring semantically across answers. Empty for divergent.",
    },
    shared_frame: {
      type: ["string", "null"],
      description:
        "For higher_abstraction: the shared system/place found in the writer's own phrases. Null otherwise.",
    },
    message: {
      type: "string",
      description:
        "Writer-facing message following the branch template. No added commentary.",
    },
  },
  required: [
    "extracted_phrases",
    "branch",
    "recurring",
    "shared_frame",
    "message",
  ],
};

function composeInput(material: string, answers: AnsweredQuestion[]): string {
  const answersJson = JSON.stringify(
    answers.map((a) => ({
      angle_id: a.angle_id,
      angle_name: a.angle_name,
      question: a.question,
      answer: a.answer,
    })),
    null,
    2,
  );
  return `素材世界：\n<material>\n${material}\n</material>\n\n作者的回答：\n<answers>\n${answersJson}\n</answers>`;
}

export async function synthesize(
  material: string,
  answers: AnsweredQuestion[],
  providerId?: string,
): Promise<FocusedCallResult<SynthesisResult>> {
  return focusedCall<SynthesisResult>({
    text: composeInput(material, answers),
    systemPrompt: SYSTEM_PROMPT,
    toolName: TOOL_NAME,
    toolDescription: TOOL_DESCRIPTION,
    inputSchema: INPUT_SCHEMA,
    providerId,
  });
}

export { type AnsweredQuestion, type SynthesisResult };

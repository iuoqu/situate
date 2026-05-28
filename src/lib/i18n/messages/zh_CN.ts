import type { MessageDictionary } from "./en";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * 简体中文 message dictionary. Missing keys fall back to English.
 */
export const messages: DeepPartial<MessageDictionary> = {
  common: {
    back_to_situate: "← Situate Editions",
    back_to_map: "← 返回地图",
    submission_id_prefix: "投稿",
    constitution_link: "编辑宪法",
    confidence_label: "置信度 {percent}%",
  },

  submit: {
    page_title: "投稿",
    lead:
      "本刊发表锚定在真实地点上的微型小说(800–2,500 词)。提交后会先经过 AI 编辑预审,几秒内就能看到判决结果。",

    section_your_story_title: "你的稿件",
    section_your_story_hint: "基本信息——标题、语言、作者身份。",
    field_title: "标题",
    field_abstract: "一句话简介(可选)",
    field_source_language: "源语言",
    field_email: "邮箱",
    field_pen_name: "笔名(可选)",
    field_pen_name_hint: "如果与本名不同。",
    email_placeholder: "you@example.com",

    section_f1_title: "F1 — 故事发生在哪里?",
    section_f1_hint:
      "在地图上点击放 pin,每个 pin 代表一个场景。最多 6 个。拖动 pin 可微调位置。pin 的顺序 = 叙事顺序。",
    pins_indicator: "{current}/6 pins",
    pins_empty: "还没有 pin。在地图上点击放第一个场景。",
    scene_label: "场景 {ordinal} · ({lon}, {lat})",
    scene_remove: "删除",
    scene_content_placeholder: "在这个地点发生了什么?把这段写在这里。",
    scene_event_date: "事件时间(可选)",
    scene_word_count: "{count} 字",
    total_words_line: "总计: {count} 字。范围 800–2,500。",
    // 故事钩子(AI 故事点子生成器,免费功能)
    hooks_button_label: "✨ 没思路?让我们基于你的坐标生成 5 个角度。",
    hooks_button_help:
      "对所有人免费。我们会根据你钉的地点生成 5 个不同的切入角度。选一个用来预填标题和摘要,也可以直接继续写。",
    hooks_button_loading: "正在生成…",
    hooks_button_regenerate: "再换 5 个新点子",
    hooks_pick_drop_pin_first: "先在地图上钉至少一个点。",
    hooks_label_kicker: "五个可选角度",
    hooks_label_hint: "选一个预填标题和摘要——或者关掉它,自己写。",
    hooks_label_write_own: "我自己写。",
    hooks_label_loading: "正在为你的坐标生成 5 个点子…",
    hooks_error_generic: "暂时生成不出来。稍后再试。",
    field_relocation_test: "为什么是这些地点、按这个顺序?(搬迁测试)",
    field_relocation_test_hint:
      "至少 50 字(目前 {count} 字)。如果把这条路线挪走或打乱,故事会怎样?引用具体的地方特征——地理、交通、语言、仪俗——而不是「这座城市的氛围」。",

    section_f2_title: "F2 — 你与这些地点的关系",
    section_f2_hint: "六个选项同等有效——这只是告诉我们你的距离。",
    rel_born_there: "在那里出生",
    rel_lived_there: "在那里住过",
    rel_worked_there: "在那里工作过",
    rel_researched: "为这个故事专门研究过",
    rel_passing_through: "路过",
    rel_never_been: "从未去过",
    field_duration: "时长 / 日期",
    duration_placeholder: "例如 2015–2020,或「3 年」",
    confidentiality_hint:
      "如果披露你与这个地点的关系可能危及你——流亡、异议写作、安全顾虑——请勾选此项,我们将保密你的亲缘信息,在发表时附一段编辑说明替代。(宪法 v0.2 / P4)",
    confidentiality_checkbox: "出于安全原因申请保密。",
    confidentiality_reason_placeholder: "简短理由(仅编辑可见)",

    section_f3_title: "F3 — 虚构还是基于现实?",
    story_type_fiction: "虚构。",
    story_type_fiction_desc:
      "人物、事件、冲突都是发明的或改造得足够多以至无法被识别。",
    story_type_reality: "基于现实。",
    story_type_reality_desc:
      "来自我目睹、经历或仔细研究过的真实事件或真实的人。",

    section_f4_title: "F4 — 真实的人",
    section_f4_hint:
      "你选择了「基于现实」。请告诉我们稿件中是否有可识别的真实人物。",
    f4_has_real_people: "这个故事中包含真实的、可识别的人。",
    field_consent_status: "同意状态",
    consent_explicit: "是——我有明确的同意",
    consent_deceased: "无同意——当事人已去世",
    consent_public_figure: "无同意——公众人物的公众行为",
    consent_transformed: "无同意——经过足够改造无法识别",
    consent_no_consent: "无同意(以上皆非)",
    field_consent_explanation: "解释(若无明确同意则必填)",
    field_consent_explanation_hint:
      "简短说明——为什么在没有同意的情况下描写这个人是 ok 的?",
    field_real_persons_list: "这些人是谁?",
    field_real_persons_list_hint:
      "简短描述;每行一个或用逗号分隔。",

    section_f5_title: "F5 — 写作中是否使用了 AI",
    section_f5_hint:
      "请诚实。AI 翻译 ≠ AI 创作。(译者端的 AI 使用在每条译本上单独记录。)",
    ai_human_written: "纯人写。",
    ai_human_written_desc: "写作过程中完全没有用 AI",
    ai_translated: "人写,AI 翻译。",
    ai_translated_desc:
      "原文是我写的;AI 处理了翻译或语言层的校对",
    ai_assisted: "AI 辅助。",
    ai_assisted_desc:
      "AI 帮我做了头脑风暴或部分改写,但想象是我的",
    ai_created: "AI 创作。",
    ai_created_desc:
      "AI 完成了或实质性改写了文字——按 P10 标记编辑审查",
    field_ai_notes: "备注(可选)",
    ai_notes_placeholder: "例如「让 Claude 打了开篇草稿,我自己重写了。」",

    section_f6_title: "F6 — 已知的伤害风险",
    section_f6_hint:
      "给编辑团队的提前通知。提前披露不会自动拒稿——隐瞒才会在后期出问题。",
    risk_recently_deceased: "真实的、最近去世的人(≤10 年)",
    risk_recent_disaster: "真实的、最近的灾难或悲剧",
    risk_ongoing_conflict: "正在进行的冲突或创伤",
    risk_strong_local_reaction:
      "我知道特定的人或群体会有强烈反应",
    risk_satire: "这是讽刺作品。",
    field_risks_explanation: "请解释(≥ 50 字)",
    field_risks_explanation_hint: "如果勾选了上面任一项,这里必填。",

    section_f7_title: "F7 — 法律声明",
    section_f7_hint: "你在此处的签字是一份法律声明。",
    attestation_text:
      "我已阅读并接受 {constitution_link}。本表中信息真实准确。我对涉及真实人物的声明承担法律责任。我理解如出现法律问题,本作可能被下架。",
    attestation_constitution_link: "编辑宪法({signature})",

    button_submit: "提交审稿",
    button_submit_loading: "AI 编辑正在阅读你的稿件——大约 10 秒…",

    err_no_pins: "请至少在地图上放一个 pin。",
    err_word_count:
      "总字数必须在 800 到 2,500 之间(目前 {count})。",
    err_relocation_too_short:
      "「为什么是这些地点、按这个顺序」至少 50 字(目前 {count})。",
    err_attestation_required: "请先勾选四条法律声明再提交。",
  },

  thanks: {
    headline_passed: "你的稿件通过了 AI 预审。",
    headline_flagged: "AI 编辑标记了你的稿件,转人工审查。",
    headline_declined: "AI 编辑驳回了你的稿件。",
    headline_unavailable: "你的稿件已进入人工审稿队列。",
    headline_pending: "AI 编辑正在阅读你的稿件。",
    headline_published: "你的稿件已发表。",

    lead_passed:
      "AI 编辑评估的每条原则都以高置信度 PASS。稿件已进入人工审稿队列——快车道通常 7 天内回复。",
    lead_flagged:
      "至少有一条原则的判决不确定。人工编辑接手,通常 14 天内回复。",
    lead_declined:
      "AI 编辑的预审发现了对宪法的高置信度违反。稿件已退回草稿状态——根据下方引用的原则修改后可重新提交。",
    lead_unavailable:
      "AI 预审暂时不可用,你的稿件已直接进入人工队列。通常 14 天内回复。",
    lead_pending:
      "稍等——过一会儿刷新此页面。如果一直没有内容出现,说明 AI 预审静默失败,稿件已经在人工队列里。",
    lead_published: "已上线。谢谢你把这篇作品交给我们。",

    your_piece_label: "你的稿件",
    piece_meta: "{words} 字 · {language} · {story_type}",
    section_per_principle: "AI 编辑的逐条原则审读",
    empty_unavailable:
      "本次投稿没有触达 AI 编辑——没有逐条原则审读可显示。人工编辑接手。",
    empty_pending: "暂无判决记录。如果 AI 编辑仍在运行,请稍后刷新。",
    confidence_label: "置信度 {percent}%",
    flagged_for_human: "已标记由人工复审",
    footer:
      "AI 编辑是预审,不是发表决定。人工编辑做最终判断。判决引用公开的 {constitution_link}。",
  },
};

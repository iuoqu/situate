-- Fix span positions on the demo "明天 / tomorrow" cultural annotation.
--
-- Bug: bootstrap.sql copied the same annotation row (with spanStart=22,
-- spanEnd=32) onto both the zh_CN original and the en AI translation, but
-- those character positions are language-specific. Result: the renderer
-- substituted into the wrong characters in both languages.
--
-- Correct positions:
--   zh_CN "乘客上车时只说一句:请送我去明天..."  → "明天" is at 14-16
--   en    "When the passenger ... please take me to \"tomorrow\"..."
--                                              → "\"tomorrow\"" is at 63-73
--
-- Idempotent: rewrites the entire annotations array based on (block_id,
-- language, method), so re-running just sets the values again.

UPDATE block_translations
SET annotations = '[{"spanStart":14,"spanEnd":16,"kind":"wordplay","source":"明天","defaultRendering":"literal","renderings":{"literal":"明天","transposed":"另一个明天","explained":"明天(此处暗指来世)"},"note":"乘客的目的地是一种委婉说法;直译保留歧义,本土化将之明示。"}]'::jsonb
WHERE block_id = '44444444-0000-0000-0000-000000000002'
  AND language = 'zh_CN'
  AND method = 'original';

UPDATE block_translations
SET annotations = $$[{"spanStart":63,"spanEnd":73,"kind":"wordplay","source":"明天","defaultRendering":"literal","renderings":{"literal":"\"tomorrow\"","transposed":"the next life","explained":"\"tomorrow\" (a colloquial Chinese euphemism for the next life)"},"note":"The passenger's destination is a Chinese euphemism; literal rendering preserves the ambiguity, transposed clarifies."}]$$::jsonb
WHERE block_id = '44444444-0000-0000-0000-000000000002'
  AND language = 'en'
  AND method = 'ai';

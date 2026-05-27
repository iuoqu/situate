import { VoiceDemoClient } from "./voice-demo-client";

export const metadata = {
  title: "Voice capture demo · Situate Editions",
  description:
    "Internal Week-1 demo of the voice-to-fiction recorder, live transcript, and Haiku-driven mid-recording prompts.",
};

export default function VoiceDemoPage() {
  return <VoiceDemoClient />;
}

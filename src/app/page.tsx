import { PageShell } from "@/components/shell/PageShell";
import { QuizFlow } from "@/components/quiz/QuizFlow";

export default function Home() {
  return (
    <PageShell title="Quiz Swipe & Play">
      <QuizFlow />
    </PageShell>
  );
}

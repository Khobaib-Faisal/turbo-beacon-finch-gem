import { createFileRoute, useParams } from "@tanstack/react-router";
import { TestAttemptPage } from "@/components/test-attempt";

export const Route = createFileRoute("/test/$attemptId")({
  component: TestRoute,
});

function TestRoute() {
  const { attemptId } = useParams({ from: "/test/$attemptId" });
  return <TestAttemptPage attemptId={attemptId} />;
}

import { accelerators } from "@/mocks/fixtures";
import View from "./view";

export function generateStaticParams() {
  return accelerators.map((a) => ({ id: a.id }));
}

export default function Page() {
  return <View />;
}

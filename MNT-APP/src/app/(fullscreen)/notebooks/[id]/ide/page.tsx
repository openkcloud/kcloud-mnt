import { notebooks } from "@/mocks/fixtures";
import View from "./view";

export function generateStaticParams() {
  return notebooks.map((n) => ({ id: n.id }));
}

export default function Page() {
  return <View />;
}

import { vms } from "@/mocks/fixtures";
import View from "./view";

export function generateStaticParams() {
  return vms.map((v) => ({ id: v.id }));
}

export default function Page() {
  return <View />;
}

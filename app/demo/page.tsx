import DemoHero4 from "@/components/ui/demo";
import AdvancedStats from "@/components/ui/advanced-stats";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-white">
      <DemoHero4 />
      <div id="features" className="border-t border-zinc-100">
        <AdvancedStats />
      </div>
    </main>
  );
}

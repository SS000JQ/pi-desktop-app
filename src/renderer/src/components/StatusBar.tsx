export default function StatusBar() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-0.5 bg-[#0F172A] border-t border-[#1E293B] text-[10px] text-dim font-mono flex-shrink-0">
      <span className="w-1 h-1 rounded-full bg-success" />
      <span>Connected</span>
      <span className="text-[#1E293B]">|</span>
      <span>Sonnet 4.6</span>
      <span className="text-[#1E293B]">|</span>
      <span>0 calls</span>
      <span className="ml-auto">0 files in context</span>
    </div>
  )
}

export default function StatusBar() {
  return (
    <div className="stb">
      <span className="sdot" style={{ background: 'rgba(48,209,88,0.4)' }} />
      <span>Connected</span>
      <span style={{ color: 'rgba(255,255,255,0.04)' }}>|</span>
      <span>Sonnet 4.6</span>
      <span style={{ color: 'rgba(255,255,255,0.04)' }}>|</span>
      <span>0 calls</span>
      <span className="ml-auto">0 files in context</span>
    </div>
  )
}

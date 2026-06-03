import { useState, useEffect } from 'react'

interface ProfileData {
  id: string
  name: string
  createdAt: string
  defaultModel?: string
}

interface ProfileProps {
  onClose: () => void
}

export default function Profile({ onClose }: ProfileProps) {
  const [profiles, setProfiles] = useState<ProfileData[]>([])
  const [activeId, setActiveId] = useState('default')
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [listRes, activeRes] = await Promise.all([
      window.piDesktop.profiles.list(),
      window.piDesktop.profiles.getActive()
    ])
    if (listRes.success && listRes.data) setProfiles(listRes.data as ProfileData[])
    if (activeRes.success && activeRes.data) setActiveId(activeRes.data as string)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const res = await window.piDesktop.profiles.create(newName.trim())
    if (res.success) {
      setNewName('')
      setShowCreate(false)
      load()
    }
  }

  async function handleSwitch(id: string) {
    await window.piDesktop.profiles.switch(id)
    setActiveId(id)
  }

  async function handleDelete(id: string) {
    await window.piDesktop.profiles.delete(id)
    if (activeId === id) setActiveId('default')
    load()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[#0F172A] border border-border rounded-lg w-[400px] max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold">Profiles</h2>
          <button onClick={onClose} className="text-dim hover:text-muted text-sm">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {profiles.map(p => (
            <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${p.id === activeId ? 'bg-surface border-accent' : 'bg-surface border-border hover:border-muted'}`} onClick={() => handleSwitch(p.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.id === activeId && <span className="text-[10px] text-success">active</span>}
                </div>
                <div className="text-[11px] text-muted">Created {new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              {p.id !== activeId && (
                <button onClick={e => { e.stopPropagation(); handleDelete(p.id) }} className="text-dim hover:text-error text-xs px-1">✕</button>
              )}
            </div>
          ))}

          {showCreate && (
            <div className="bg-surface border border-border rounded-lg p-3 space-y-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} className="w-full bg-[#0F172A] border border-border rounded px-2 py-1.5 text-xs text-[#F1F5F9] outline-none focus:border-accent" placeholder="Profile name" autoFocus />
              <div className="flex gap-2">
                <button onClick={handleCreate} disabled={!newName.trim()} className="px-2 py-1 text-[10px] bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-40">Create</button>
                <button onClick={() => setShowCreate(false)} className="px-2 py-1 text-[10px] bg-surface text-muted rounded hover:text-[#F1F5F9]">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {!showCreate && (
          <div className="px-4 py-3 border-t border-[#1E293B]">
            <button onClick={() => setShowCreate(true)} className="text-xs text-accent hover:text-accent-hover">+ New Profile</button>
          </div>
        )}
      </div>
    </div>
  )
}

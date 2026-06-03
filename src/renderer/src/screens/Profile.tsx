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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: '380px', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title">Profiles</h2>
          <button onClick={onClose} className="modal-x">✕</button>
        </div>

        <div className="modal-body">
          {profiles.map(p => (
            <div key={p.id} className={`ci ${p.id === activeId ? 'active' : ''}`} onClick={() => handleSwitch(p.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <span className="cit">{p.name}</span>
                  {p.id === activeId && <span className="cib">active</span>}
                </div>
                <div className="cim">Created {new Date(p.createdAt).toLocaleDateString()}</div>
              </div>
              {p.id !== activeId && (
                <button onClick={e => { e.stopPropagation(); handleDelete(p.id) }} className="cix">✕</button>
              )}
            </div>
          ))}

          {showCreate && (
            <div className="ci" style={{ display: 'block', padding: '12px' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} className="fi" placeholder="Profile name" autoFocus />
              <div className="flex" style={{ gap: '6px', marginTop: '8px' }}>
                <button onClick={handleCreate} disabled={!newName.trim()} className="bp">Create</button>
                <button onClick={() => setShowCreate(false)} className="bs">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {!showCreate && (
          <div className="modal-ftr">
            <button onClick={() => setShowCreate(true)} className="bt">+ New Profile</button>
          </div>
        )}
      </div>
    </div>
  )
}

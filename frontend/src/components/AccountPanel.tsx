import { useState, type FormEvent } from "react";
import type { User } from "../types";

interface Props { user: User; onClose: () => void; onLogout: () => Promise<void>; onUpdateProfile: (name: string) => Promise<void>; onChangePassword: (current: string, next: string) => Promise<void>; }
const errorText = (e: unknown) => (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Impossible d’enregistrer cette modification.";

export default function AccountPanel({ user, onClose, onLogout, onUpdateProfile, onChangePassword }: Props) {
  const [name, setName] = useState(user.display_name || "");
  const [current, setCurrent] = useState(""); const [next, setNext] = useState("");
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function saveProfile(e: FormEvent) { e.preventDefault(); setError(""); try { await onUpdateProfile(name); setMessage("Profil mis à jour."); } catch (x) { setError(errorText(x)); } }
  async function savePassword(e: FormEvent) { e.preventDefault(); setError(""); try { await onChangePassword(current, next); setCurrent(""); setNext(""); setMessage("Mot de passe modifié."); } catch (x) { setError(errorText(x)); } }
  return <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}><aside onMouseDown={(e) => e.stopPropagation()} className="ml-auto h-full w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-surface p-7 shadow-2xl">
    <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-category-algorithm">Compte Atlas</p><h2 className="mt-1 font-display text-3xl">Votre espace</h2></div><button onClick={onClose} className="text-2xl text-ink-dim">×</button></div>
    <p className="mt-2 text-sm text-ink-dim">{user.email}</p>
    <form onSubmit={saveProfile} className="mt-8 space-y-3"><h3 className="text-sm font-semibold">Profil</h3><input required maxLength={64} value={name} onChange={(e) => setName(e.target.value)} className="atlas-input w-full" /><button className="rounded-lg border border-white/15 px-4 py-2 text-xs hover:bg-white/5">Enregistrer le nom</button></form>
    <form onSubmit={savePassword} className="mt-8 space-y-3"><h3 className="text-sm font-semibold">Sécurité</h3><input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Mot de passe actuel" className="atlas-input w-full" /><input type="password" required minLength={10} maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Nouveau mot de passe (10 caractères min.)" className="atlas-input w-full" /><button className="rounded-lg border border-white/15 px-4 py-2 text-xs hover:bg-white/5">Changer le mot de passe</button></form>
    {message && <p className="mt-4 text-sm text-category-algorithm">{message}</p>}{error && <p className="mt-4 text-sm text-category-problem">{error}</p>}
    <button onClick={async () => { await onLogout(); onClose(); }} className="mt-10 w-full rounded-xl border border-category-problem/30 py-3 text-sm text-category-problem hover:bg-category-problem/10">Se déconnecter</button>
  </aside></div>;
}

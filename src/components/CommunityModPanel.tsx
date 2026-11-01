import React, { useCallback, useEffect, useState } from 'react';
import { communityModApi, Community, CommunityType, ModLogEntry, ModMember } from '../lib/api';

interface Props {
  community: Community;
  onChanged: () => void;
}

type Section = 'requests' | 'members' | 'banned' | 'log' | 'settings';

const ACTION_LABELS: Record<string, string> = {
  approve_member: 'aprovou a entrada de',
  reject_member: 'recusou a entrada de',
  ban: 'baniu',
  unban: 'tirou o banimento de',
  add_moderator: 'tornou moderador',
  remove_moderator: 'tirou de moderador',
  approve_poster: 'aprovou para publicar',
  revoke_poster: 'tirou a aprovação de publicar de',
  remove_post: 'removeu uma publicação de',
  update_settings: 'alterou as configurações',
};

const inputCls =
  'w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-base sm:text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20';
const btnCls = 'px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer disabled:opacity-50';

export const CommunityModPanel: React.FC<Props> = ({ community, onChanged }) => {
  const isOwner = community.my_role === 'owner';
  const [section, setSection] = useState<Section>(community.pending_count ? 'requests' : 'members');
  const [people, setPeople] = useState<ModMember[]>([]);
  const [log, setLog] = useState<ModLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<number | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDays, setBanDays] = useState('');

  // Configurações
  const [description, setDescription] = useState(community.description || '');
  const [welcome, setWelcome] = useState(community.welcome_message || '');
  const [tagsText, setTagsText] = useState((community.tags || []).map((t) => '#' + t).join(' '));
  const [requireTag, setRequireTag] = useState(Boolean(community.require_tag));
  const [type, setType] = useState<CommunityType>(community.type || 'public');
  const [rules, setRules] = useState<Array<{ title: string; description: string }>>(
    (community.rules || []).map((r) => ({ title: r.title, description: r.description || '' }))
  );
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (section === 'settings') return;
    setLoading(true);
    setError(null);
    try {
      if (section === 'log') setLog(await communityModApi.log(community.id));
      else setPeople(await communityModApi.list(community.id, section));
    } catch (e: any) {
      setError(e.message || 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [section, community.id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      await communityModApi.act(community.id, action, extra);
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message || 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  };

  const confirmBan = async () => {
    if (banTarget === null) return;
    const days = banDays.trim() === '' ? null : Number(banDays);
    await act('ban', { user_id: banTarget, reason: banReason, days });
    setBanTarget(null);
    setBanReason('');
    setBanDays('');
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const tags = tagsText.split(/[\s,]+/).map((t) => t.replace(/^#+/, '').toLowerCase()).filter(Boolean);
      await communityModApi.act(community.id, 'update_settings', {
        description,
        welcome_message: welcome,
        tags,
        require_tag: requireTag,
        rules: rules.filter((r) => r.title.trim()),
        ...(isOwner ? { type } : {}),
      });
      setSaved(true);
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const tab = (id: Section, label: string, badge?: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setSection(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap ${
        section === id ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
      }`}
    >
      {label}
      {badge ? ` (${badge})` : ''}
    </button>
  );

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-outline-variant flex flex-col gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tab('requests', 'Pedidos', community.pending_count)}
        {tab('members', 'Membros')}
        {tab('banned', 'Banidos')}
        {tab('log', 'Registro')}
        {tab('settings', 'Configurações')}
      </div>

      {error && <div className="p-3 rounded-xl bg-error-container text-error text-xs font-medium">{error}</div>}

      {section === 'settings' ? (
        <form onSubmit={saveSettings} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-on-surface">
            Descrição
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} className={inputCls + ' resize-none'} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-on-surface">
            Mensagem de boas-vindas
            <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} maxLength={500} className={inputCls + ' resize-none'} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-on-surface">
            Hashtags da comunidade (até 8)
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="#dica #duvida" autoCapitalize="none" autoCorrect="off" className={inputCls} />
          </label>
          <label className="flex items-center gap-2 text-xs text-on-surface cursor-pointer">
            <input type="checkbox" checked={requireTag} onChange={(e) => setRequireTag(e.target.checked)} className="w-4 h-4" />
            Exigir ao menos uma hashtag em cada publicação
          </label>
          {isOwner && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-on-surface">
              Tipo
              <select value={type} onChange={(e) => setType(e.target.value as CommunityType)} className={inputCls}>
                <option value="public">Pública: todos veem e publicam</option>
                <option value="restricted">Restrita: todos veem, só aprovados publicam</option>
                <option value="private">Privada: só membros veem, entrada com aprovação</option>
              </select>
            </label>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-on-surface">Regras (até 15)</span>
            {rules.map((rule, i) => (
              <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl border border-outline-variant">
                <div className="flex gap-2">
                  <input
                    value={rule.title}
                    onChange={(e) => setRules(rules.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))}
                    placeholder={`Regra ${i + 1}`}
                    maxLength={100}
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setRules(rules.filter((_, j) => j !== i))} className={`${btnCls} bg-surface-container text-on-surface-variant`} aria-label="Remover regra">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
                <input
                  value={rule.description}
                  onChange={(e) => setRules(rules.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                  placeholder="Explicação (opcional)"
                  maxLength={500}
                  className={inputCls}
                />
              </div>
            ))}
            {rules.length < 15 && (
              <button type="button" onClick={() => setRules([...rules, { title: '', description: '' }])} className={`${btnCls} self-start bg-surface-container text-on-surface`}>
                + Adicionar regra
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className={`${btnCls} px-5 py-2 bg-primary-container text-on-primary`}>
              Salvar
            </button>
            {saved && <span className="text-xs text-on-surface-variant">Salvo.</span>}
          </div>
        </form>
      ) : loading ? (
        <p className="text-xs text-on-surface-variant py-4 text-center">Carregando...</p>
      ) : section === 'log' ? (
        log.length === 0 ? (
          <p className="text-xs text-on-surface-variant py-4 text-center">Nenhuma ação de moderação ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant">
            {log.map((l) => (
              <li key={l.id} className="py-2 text-xs text-on-surface">
                <span className="font-semibold">@{l.moderator_name || 'moderação'}</span> {ACTION_LABELS[l.action] || l.action}
                {l.target_name ? <span className="font-semibold"> @{l.target_name}</span> : ''}
                {l.note ? <span className="text-on-surface-variant"> ({l.note})</span> : ''}
                <span className="block text-[10px] text-on-surface-variant">{new Date(l.created_at.replace(' ', 'T') + 'Z').toLocaleString('pt-BR')}</span>
              </li>
            ))}
          </ul>
        )
      ) : people.length === 0 ? (
        <p className="text-xs text-on-surface-variant py-4 text-center">
          {section === 'requests' ? 'Nenhum pedido pendente.' : section === 'banned' ? 'Ninguém banido.' : 'Nenhum membro.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-outline-variant">
          {people.map((p) => (
            <li key={p.user_id} className="py-2.5 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-on-surface">@{p.username}</span>
                {p.role !== 'member' && (
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-semibold text-on-surface-variant">
                    {p.role === 'owner' ? 'fundador' : 'moderador'}
                  </span>
                )}
                {p.approved_poster && <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-semibold text-on-surface-variant">pode publicar</span>}
                {p.status === 'banned' && (
                  <span className="text-[10px] text-on-surface-variant">
                    {p.banned_until ? `até ${new Date(p.banned_until.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}` : 'permanente'}
                    {p.ban_reason ? ` · ${p.ban_reason}` : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {section === 'requests' && (
                  <>
                    <button type="button" disabled={busy} onClick={() => act('approve', { user_id: p.user_id })} className={`${btnCls} bg-primary-container text-on-primary`}>Aprovar</button>
                    <button type="button" disabled={busy} onClick={() => act('reject', { user_id: p.user_id })} className={`${btnCls} bg-surface-container text-on-surface`}>Recusar</button>
                  </>
                )}
                {section === 'banned' && (
                  <button type="button" disabled={busy} onClick={() => act('unban', { user_id: p.user_id })} className={`${btnCls} bg-surface-container text-on-surface`}>Tirar banimento</button>
                )}
                {section === 'members' && p.role !== 'owner' && (isOwner || p.role !== 'moderator') && (
                  <>
                    {community.type === 'restricted' && (
                      <button type="button" disabled={busy} onClick={() => act('set_poster', { user_id: p.user_id, value: !p.approved_poster })} className={`${btnCls} bg-surface-container text-on-surface`}>
                        {p.approved_poster ? 'Tirar permissão de publicar' : 'Permitir publicar'}
                      </button>
                    )}
                    {isOwner && (
                      <button type="button" disabled={busy} onClick={() => act('set_role', { user_id: p.user_id, role: p.role === 'moderator' ? 'member' : 'moderator' })} className={`${btnCls} bg-surface-container text-on-surface`}>
                        {p.role === 'moderator' ? 'Tirar de moderador' : 'Tornar moderador'}
                      </button>
                    )}
                    {p.role !== 'moderator' && (
                      <button type="button" disabled={busy} onClick={() => setBanTarget(p.user_id)} className={`${btnCls} bg-error-container text-error`}>Banir</button>
                    )}
                  </>
                )}
              </div>
              {banTarget === p.user_id && (
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container">
                  <input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Motivo (a pessoa vê)" maxLength={200} className={inputCls} />
                  <input value={banDays} onChange={(e) => setBanDays(e.target.value.replace(/\D/g, ''))} placeholder="Dias (vazio = permanente)" inputMode="numeric" className={inputCls} />
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={confirmBan} className={`${btnCls} bg-error-container text-error`}>Confirmar banimento</button>
                    <button type="button" onClick={() => setBanTarget(null)} className={`${btnCls} bg-surface-container-high text-on-surface`}>Cancelar</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

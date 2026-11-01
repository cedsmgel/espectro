import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profileDetailsApi, ProfileDetailsMap } from '../lib/api';
import { PROFILE_FIELDS, displayValue, parseLinks, parseTags } from '../lib/profileFields';

interface ProfileAboutProps {
  username: string;
  isSelf: boolean;
}

// Bloco "Sobre" do perfil: mostra só o que o visitante pode ver
export const ProfileAbout: React.FC<ProfileAboutProps> = ({ username, isSelf }) => {
  const [details, setDetails] = useState<ProfileDetailsMap | null>(null);

  useEffect(() => {
    let active = true;
    setDetails(null);
    const request = isSelf ? profileDetailsApi.getMine() : profileDetailsApi.getFor(username);
    request.then((d) => active && setDetails(d)).catch(() => active && setDetails({}));
    return () => {
      active = false;
    };
  }, [username, isSelf]);

  if (details === null) return null;

  const rows = PROFILE_FIELDS.filter((def) => def.kind !== 'links' && def.kind !== 'tags' && details[def.key]?.value);
  const tags = parseTags(details.interests?.value);
  const links = parseLinks(details.links?.value);

  if (rows.length === 0 && tags.length === 0 && links.length === 0) {
    if (!isSelf) return null;
    return (
      <Link to="/settings/profile" className="border-t border-outline-variant pt-4 flex items-center gap-2 text-xs text-primary hover:underline">
        <span className="material-symbols-outlined text-[18px]">add_circle</span>
        Complete seu perfil: cidade, aniversário, interesses e links
      </Link>
    );
  }

  return (
    <section className="border-t border-outline-variant pt-4 flex flex-col gap-4" aria-label="Sobre">
      <h2 className="font-bold text-base text-on-surface">Sobre</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((def) => (
          <div key={def.key} className="flex items-center gap-2.5 min-w-0 pb-3 border-b border-outline-variant">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">{def.icon}</span>
            <div className="min-w-0">
              <dt className="text-[11px] text-on-surface-variant">{def.label}</dt>
              <dd className="text-xs text-on-surface font-medium truncate">{displayValue(def.key, details[def.key].value)}</dd>
            </div>
          </div>
        ))}
      </dl>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full border border-outline-variant text-xs text-on-surface">
              {tag}
            </span>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 text-xs text-primary hover:underline">
                <span className="material-symbols-outlined text-[16px]">link</span>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

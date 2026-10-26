import { z } from 'zod';

export function normalizeWorkLink(value: string) {
  let link = value.trim().replace(/^(?:[-*\u2022]\s*|\d+[.)]\s+)/, '');
  if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?:[/?#:]|$)/i.test(link)) {
    link = 'https://' + link;
  }
  return link;
}

export const splitWorkLinks = (value: string) => value.split(/\r\n|\r|\n/).map(normalizeWorkLink).filter(Boolean);

export const workLinksSchema = z.string().max(30734).superRefine((value, context) => {
  const links = splitWorkLinks(value);
  if (links.length > 15) {
    context.addIssue({code: z.ZodIssueCode.custom, message: 'Add at most 15 links, one per line'});
  }
  for (const [index, link] of links.entries()) {
    let valid = link.length <= 2048;
    try {
      const url = new URL(link);
      valid = valid && /^https?:$/.test(url.protocol) && !!url.hostname && !url.username && !url.password;
    } catch {
      valid = false;
    }
    if (!valid) {
      context.addIssue({code: z.ZodIssueCode.custom, message: `Link ${index + 1}: use an HTTP or HTTPS URL without login credentials (maximum 2048 characters)`});
    }
  }
}).transform(value => splitWorkLinks(value).join('\n'));

import { denied, requireMember, type MemberData, type MemberEnv } from './auth';
import { serveCompletionPhoto } from '../completion-photo-helpers';

export const onRequestGet: PagesFunction<MemberEnv, string, MemberData> = async context => {
  if (!requireMember(context)) return denied();
  return serveCompletionPhoto(context.env.DB, context.request, context.data.member!.email);
};

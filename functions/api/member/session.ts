import { denied, requireMember, type MemberData, type MemberEnv } from './auth';

export const onRequestGet: PagesFunction<MemberEnv, string, MemberData> = context => {
  if (!requireMember(context)) return denied();
  return Response.json(context.data.member, { headers: { 'Cache-Control': 'no-store' } });
};

export const onRequestGet: PagesFunction = ({ request }) => Response.redirect(new URL('/?view=notifications', request.url).toString(), 302);

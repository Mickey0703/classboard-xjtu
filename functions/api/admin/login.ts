export const onRequestGet: PagesFunction = ({ request }) => Response.redirect(new URL('/?view=admin', request.url).toString(), 302);

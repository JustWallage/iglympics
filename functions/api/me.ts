import { isAdmin } from "../_lib/auth";

interface UserData {
  id: number;
  name: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user: UserData }).user;

  return Response.json({
    user: { id: user.id, name: user.name },
    isAdmin: isAdmin(user.name, context.env.ADMIN_NAMES),
  });
};

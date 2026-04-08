interface UserData {
  id: number;
  email: string;
  name: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = (context.data as { user: UserData }).user;

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email },
    isAdmin: user.email === context.env.ADMIN_EMAIL,
  });
};

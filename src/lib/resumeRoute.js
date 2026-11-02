// Installed apps launch at /; a valid server session should resume the app.
export function resumeRoute(route, user) {
  if (user && ["/", "/login", "/signup", "/auth"].includes(route))
    return user.profile ? "/dashboard" : "/profile";
  return route;
}

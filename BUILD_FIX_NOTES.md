# Clean build fix

`vite.config.js` previously imported `@vitejs/plugin-react` even though that package was not declared in `package.json`/`package-lock.json`. A clean `npm ci` therefore failed at `vite build` with `ERR_MODULE_NOT_FOUND`.

The release compatibility transform already works as a Vite plugin and React production code imports React directly, so the undeclared React plugin dependency was removed from the Vite config instead of adding a partially reconstructed lockfile dependency.

## The Front End Setup

This is the base frontend setup containing a "dev.Dockerfile", a dockerignore, and the application code in its own directory ("vite-app").

the "vite-app" directory was build using "create-vite@5.5.5" (simply by running yarn create vite locally)

The configuration worked as follows:

	Project name: "vite-app"
	Select a Framework: "React"
	Select a variant: "TypeScript + SWC" (SWC= Speedy Web Compiler, as opposed to the regular Babel compiler)
	

REMINDER: 
 - the node modules will not be filled when just running docker compose, to get access to syntax highlighting etc. in your IDE, just install them locally.
   This has the benefit that the container always has its own modules, which may be platform specific, and can run independently of the host system
 - keep the lock file up to date and inside git, since it's usually platform independent and provides a safe starting point with fixed versions unlike the less strict versions numbers given inside the package.json



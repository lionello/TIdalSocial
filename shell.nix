with import <nixpkgs> { };
let
  # callPackage' = path: overrides: callPackage path (overrides // { stdenv = self.gcc8Stdenv; });
  # fixStdenv = drv: drv.overrideAttrs (_: { ca = gcc8Stdenv; });
  implicit = ps: ps.callPackage nix/implicit.nix { };
  nmslib = ps: ps.callPackage nix/nmslib.nix { };
  # python3gcc = python3.override { callPackage = callPackage'; };#Attrs (_: { stdenv = gcc8Stdenv; });
  #python3' = python3.withPackages(ps: with ps; [ (implicit ps) (nmslib ps) h5py numpy annoy ipykernel flask black ]);
  python37gcc = python37.override { stdenv = gccStdenv; };
  python37' = python37.withPackages(ps: with ps; [ poetry ]);
  python27' = python27.withPackages(ps: with ps; [ virtualenv numpy ]);
in mkShell {
  #name = "gcc-nix-shell";
  buildInputs = [
    nodejs-14_x
    python37
    darwin.apple_sdk.frameworks.Accelerate
    darwin.apple_sdk.frameworks.IOKit
    #poetry.python
    overmind
    #lapack
    #openblas
    #mkl
    #openmp
    azure-cli
  ];
  OPENBLAS_NUM_THREADS = 1; # Recommended by implicit
  PYTHONFAULTHANDLER = 1;   # Show SIGSEGV stack traces
  NODE_ENV = "development";
  FLASK_ENV = "development";
}

{ pkgs ? import <nixpkgs> { } }:
with pkgs;
let
  # callPackage' = path: overrides: callPackage path (overrides // { stdenv = self.gcc8Stdenv; });
  # fixStdenv = drv: drv.overrideAttrs (_: { ca = gcc8Stdenv; });
  implicit = ps: ps.callPackage nix/implicit.nix { };
  nmslib = ps: ps.callPackage nix/nmslib.nix { };
  # python3gcc = python3.override { callPackage = callPackage'; };#Attrs (_: { stdenv = gcc8Stdenv; });
  #python3' = python3.withPackages (ps: with ps; [ (implicit ps) (nmslib ps) h5py numpy annoy ipykernel flask black ]);
  python37gcc = python37.override { stdenv = gccStdenv; };
  python38' = python38.withPackages (ps: [ ps.pip ps.setuptools ps.wheel /*ps.poetry*/ ]);
  python27' = python27.withPackages (ps: [ ps.virtualenv ps.numpy ]);
  # Wrap Azure-CLI to avoid it leaking its own Python interpreter in PATH, see https://discourse.nixos.org/t/nix-shell-buildinputs-ordering-issue/12885
  azure-cli' = writeShellScriptBin "az" "exec ${azure-cli}/bin/az \"$@\"";
in
mkShell {
  #name = "gcc-nix-shell";
  buildInputs = [
    azure-cli'
    git
    #lapack
    #mkl
    nodejs-14_x
    #openblas
    #openmp
    overmind
    #poetry.python
    python38'
  ] ++ lib.optionals stdenv.isDarwin [
    darwin.apple_sdk.frameworks.Accelerate
    darwin.apple_sdk.frameworks.IOKit
  ];
  OPENBLAS_NUM_THREADS = 1; # Recommended by implicit
  PYTHONFAULTHANDLER = 1; # Show SIGSEGV stack traces
  NODE_ENV = "development";
  FLASK_ENV = "development";
}

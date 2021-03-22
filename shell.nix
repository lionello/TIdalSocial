with import <nixpkgs> { };
let
  # callPackage' = path: overrides: callPackage path (overrides // { stdenv = self.gcc8Stdenv; });
  # fixStdenv = drv: drv.overrideAttrs (_: { ca = gcc8Stdenv; });
  implicit = ps: ps.callPackage nix/implicit.nix {};
  nmslib = ps: ps.callPackage nix/nmslib.nix {};
  # python3gcc = python3.override { callPackage = callPackage'; };#Attrs (_: { stdenv = gcc8Stdenv; });
  #python3' = python3.withPackages(ps: with ps; [ (implicit ps) (nmslib ps) h5py numpy annoy ipykernel flask black ]);
  python3' = python3.withPackages(ps: with ps; [ poetry ]);
in mkShell {
  buildInputs = [
    nodejs-12_x
    poetry
    #poetry.python
    overmind
  ];
  OPENBLAS_NUM_THREADS = 1; # Recommended by implicit
}

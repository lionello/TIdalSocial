with import <nixpkgs> { };
let
  implicit = ps: ps.callPackage nix/implicit.nix {};
  nmslib = ps: ps.callPackage nix/nmslib.nix {};
  python3' = python3.withPackages(ps: with ps; [ (implicit ps) (nmslib ps) h5py numpy annoy ipykernel ]);
in mkShell {
  buildInputs = [
    nodejs-12_x
    python3'
  ];
  OPENBLAS_NUM_THREADS = 1; # Recommended by implicit
}

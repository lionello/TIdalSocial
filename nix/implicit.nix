{ lib, buildPythonPackage, fetchPypi, tqdm, scipy }:

buildPythonPackage rec {
  pname = "implicit";
  version = "0.4.4";

  src = fetchPypi {
    inherit pname version;
    sha256 = "1xn2jp3hhxpvdzcllna9pbhgg364clsfxgr8amlpdiildrm9di2f";
  };

  propagatedBuildInputs = [
    scipy
    tqdm
  ];

  doCheck = false; # no tests

  meta = with lib; {
    description = "Fast Python Collaborative Filtering for Implicit Datasets";
    homepage = "https://github.com/benfred/implicit";
    license = licenses.mit;
    maintainers = with maintainers; [ lionello ];
  };
}

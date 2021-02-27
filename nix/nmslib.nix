{ lib, buildPythonPackage, fetchPypi, numpy, tqdm, psutil, pybind11, sphinx_rtd_theme }:

buildPythonPackage rec {
  pname = "nmslib";
  version = "2.1.1";

  src = fetchPypi {
    inherit pname version;
    sha256 = "084wl5kl2grr2yi3bibc6i2ak5s7vanwi21wssbwd4bgfskr84lp";
  };

  doCheck = false; # no tests

  propagatedBuildInputs = [
    numpy
    psutil
    pybind11
    sphinx_rtd_theme
  ];

  meta = with lib; {
    description = "Non-Metric Space Library (NMSLIB)";
    homepage = "https://github.com/nmslib/nmslib";
    license = licenses.asl20;
    maintainers = with maintainers; [ lionello ];
  };
}

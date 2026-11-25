// Filesystem compatibility shim, preloaded into Next.js via scripts/run-next.cjs.
// On some filesystems (notably exFAT drives on Windows) readlink() on a regular file fails with
// EISDIR instead of the usual EINVAL ("not a symlink"). Tooling such as Next's output-file tracer
// only tolerates EINVAL/ENOENT, so normalise the error code. Harmless on NTFS, ext4 and APFS.
const fs = require("fs");

const normalise = (err) => {
  if (err && err.code === "EISDIR" && err.syscall === "readlink") err.code = "EINVAL";
  return err;
};

const readlink = fs.readlink;
fs.readlink = function (path, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  return readlink.call(fs, path, options, (err, link) => callback(normalise(err), link));
};

const readlinkSync = fs.readlinkSync;
fs.readlinkSync = function (...args) {
  try {
    return readlinkSync.apply(fs, args);
  } catch (err) {
    throw normalise(err);
  }
};

const readlinkPromise = fs.promises.readlink;
fs.promises.readlink = async function (...args) {
  try {
    return await readlinkPromise.apply(fs.promises, args);
  } catch (err) {
    throw normalise(err);
  }
};

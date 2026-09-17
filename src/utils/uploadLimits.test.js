import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_SIZE_ERROR,
  validateUploadSize,
} from "./uploadLimits.js";

test("upload size accepts the backend decimal 50 MB boundary and rejects one byte over", () => {
  assert.equal(MAX_UPLOAD_BYTES, 50_000_000);
  for (const size of [0, MAX_UPLOAD_BYTES - 1, MAX_UPLOAD_BYTES]) {
    assert.doesNotThrow(() => validateUploadSize({ size }));
  }
  assert.throws(() => validateUploadSize({ size: MAX_UPLOAD_BYTES + 1 }), {
    message: UPLOAD_SIZE_ERROR,
  });
  assert.throws(() => validateUploadSize({ size: 50 * 1024 * 1024 }), {
    message: UPLOAD_SIZE_ERROR,
  });
});

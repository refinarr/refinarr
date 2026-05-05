import { describe, test, expect } from "vitest";
import { assertSafeArrUrl, UnsafeUrlError } from "@/server/lib/url-guard";

function blocked(url: string) {
  expect(() => assertSafeArrUrl(url)).toThrow(UnsafeUrlError);
}

function allowed(url: string) {
  expect(() => assertSafeArrUrl(url)).not.toThrow();
  expect(assertSafeArrUrl(url)).toBeInstanceOf(URL);
}

describe("assertSafeArrUrl — blocked hosts", () => {
  test("AWS/Azure/GCP/DO metadata IP", () =>
    blocked("http://169.254.169.254/latest/meta-data/"));
  test("AWS metadata IP without path", () => blocked("http://169.254.169.254"));
  test("GCP metadata internal hostname", () =>
    blocked("http://metadata.google.internal/"));
  test("GCP metadata googleapis", () =>
    blocked("http://metadata.googleapis.com/"));
  test("Alibaba metadata IP", () => blocked("http://100.100.100.200/"));
  test("null route 0.0.0.0", () => blocked("http://0.0.0.0/"));
  test("IPv6 link-local fe80::1", () => blocked("http://[fe80::1]/"));
  test("IPv6 link-local uppercase FE80", () =>
    blocked("http://[FE80::dead:beef]/"));
  test("IPv6 link-local with path", () =>
    blocked("http://[fe80::1]/api/v3/system/status"));
});

describe("assertSafeArrUrl — blocked protocols", () => {
  test("ftp scheme", () => blocked("ftp://192.168.1.100:8989/"));
  test("file scheme", () => blocked("file:///etc/passwd"));
  test("ssh scheme", () => blocked("ssh://192.168.1.1/"));
});

describe("assertSafeArrUrl — invalid inputs", () => {
  test("empty string throws UnsafeUrlError", () => blocked(""));
  test("not a URL throws UnsafeUrlError", () => blocked("not a url"));
  test("bare hostname without scheme throws", () =>
    blocked("192.168.1.1:8989"));
});

describe("assertSafeArrUrl — allowed hosts (RFC1918 + loopback)", () => {
  test("RFC1918 class C", () => allowed("http://192.168.1.1:8989/"));
  test("RFC1918 class A", () => allowed("http://10.0.0.5:7878/"));
  test("RFC1918 class B", () => allowed("http://172.16.0.1:9898/"));
  test("loopback 127.0.0.1", () => allowed("http://127.0.0.1:8989/"));
  test("loopback localhost", () => allowed("http://localhost:8989/"));
  test("IPv6 loopback ::1 (not link-local)", () =>
    allowed("http://[::1]:8989/"));
  test("public HTTPS", () => allowed("https://sonarr.example.com/"));
  test("RFC1918 with path", () => allowed("http://192.168.1.100:8989/radarr"));
});

describe("assertSafeArrUrl — return value", () => {
  test("returns URL object with correct properties", () => {
    const u = assertSafeArrUrl("http://192.168.1.1:8989/radarr");
    expect(u.hostname).toBe("192.168.1.1");
    expect(u.port).toBe("8989");
    expect(u.pathname).toBe("/radarr");
  });

  test("off-by-one: 169.254.169.253 is allowed (not the metadata IP)", () => {
    allowed("http://169.254.169.253/");
  });
});

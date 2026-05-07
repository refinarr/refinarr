import { describe, test, expect } from "vitest";
import { parseMediaQuery } from "../parse-media-query";

function urlParams(qs: string) {
  return new URLSearchParams(qs);
}

describe("parseMediaQuery", () => {
  test("returns sane defaults when nothing is supplied", () => {
    const out = parseMediaQuery(urlParams(""));
    expect(out).toEqual({
      sortBy: "score",
      order: "asc",
      minScore: undefined,
      maxScore: undefined,
      minSize: undefined,
      maxSize: undefined,
      q: undefined,
      profileIds: undefined,
      severities: undefined,
      missingCfIds: undefined,
      missingCfMatch: "all",
      hasNegativeCfIds: undefined,
      hasNegativeCfMatch: "all",
      onlyMissing: false,
      // Default-on flagged-only filter; default "all" monitor status.
      flaggedOnly: true,
      monitorStatus: "all",
    });
  });

  test("threads sortBy + order through verbatim when valid", () => {
    const out = parseMediaQuery(urlParams("sortBy=size&order=desc"));
    expect(out.sortBy).toBe("size");
    expect(out.order).toBe("desc");
  });

  test("falls back to defaults when sortBy / order are invalid", () => {
    const out = parseMediaQuery(urlParams("sortBy=hax0r&order=sideways"));
    expect(out.sortBy).toBe("score");
    expect(out.order).toBe("asc");
  });

  test("parses CSV id lists and drops invalid entries", () => {
    const out = parseMediaQuery(
      urlParams(
        "profileIds=1,2,abc,3&missingCfIds=10,-1,0,11&hasNegativeCfIds=20",
      ),
    );
    expect(out.profileIds).toEqual([1, 2, 3]);
    expect(out.missingCfIds).toEqual([10, 11]);
    expect(out.hasNegativeCfIds).toEqual([20]);
  });

  test("rejects non-integer id values (1.5, 1e2 etc.)", () => {
    const out = parseMediaQuery(urlParams("profileIds=1,1.5,3,1e2,4"));
    // 1e2 parses as 100 and IS an integer, so it survives — that's
    // intentional, the rule is integer-only, not "no scientific notation".
    // `1.5` is the genuine reject.
    expect(out.profileIds).toEqual([1, 3, 100, 4]);

    const onlyFloats = parseMediaQuery(urlParams("profileIds=1.5,2.7"));
    expect(onlyFloats.profileIds).toBeUndefined();
  });

  test("returns undefined when an id list parses to nothing", () => {
    const out = parseMediaQuery(urlParams("profileIds=abc,xyz"));
    expect(out.profileIds).toBeUndefined();
  });

  test("filters severities to the valid enum", () => {
    const out = parseMediaQuery(
      urlParams("severities=critical,bogus,low,missing"),
    );
    expect(out.severities).toEqual(["critical", "low", "missing"]);
  });

  test("returns undefined when no severity is valid", () => {
    const out = parseMediaQuery(urlParams("severities=bogus,nope"));
    expect(out.severities).toBeUndefined();
  });

  test("parses numeric range bounds and rejects non-finite values", () => {
    const out = parseMediaQuery(
      urlParams("minScore=0.3&maxScore=NaN&minSize=1000&maxSize=Infinity"),
    );
    expect(out.minScore).toBe(0.3);
    expect(out.maxScore).toBeUndefined();
    expect(out.minSize).toBe(1000);
    expect(out.maxSize).toBeUndefined();
  });

  test("treats empty range bounds as undefined", () => {
    const out = parseMediaQuery(urlParams("minScore=&maxScore="));
    expect(out.minScore).toBeUndefined();
    expect(out.maxScore).toBeUndefined();
  });

  test("normalises matchMode — only `any` flips off the default `all`", () => {
    expect(
      parseMediaQuery(urlParams("missingCfMatch=any")).missingCfMatch,
    ).toBe("any");
    expect(
      parseMediaQuery(urlParams("missingCfMatch=any")).hasNegativeCfMatch,
    ).toBe("all");
    expect(
      parseMediaQuery(urlParams("missingCfMatch=junk")).missingCfMatch,
    ).toBe("all");
    // Verify hasNegativeCfMatch flips on its own param, not just inherits
    // from missingCfMatch.
    expect(
      parseMediaQuery(urlParams("hasNegativeCfMatch=any")).hasNegativeCfMatch,
    ).toBe("any");
  });

  test("treats onlyMissing as a strict boolean string", () => {
    expect(parseMediaQuery(urlParams("onlyMissing=true")).onlyMissing).toBe(
      true,
    );
    expect(parseMediaQuery(urlParams("onlyMissing=1")).onlyMissing).toBe(false);
    expect(parseMediaQuery(urlParams("")).onlyMissing).toBe(false);
  });

  test("threads q through unchanged when present", () => {
    expect(parseMediaQuery(urlParams("q=matrix")).q).toBe("matrix");
    expect(parseMediaQuery(urlParams("")).q).toBeUndefined();
  });

  test("flaggedOnly defaults to true — only `?flaggedOnly=false` flips it", () => {
    expect(parseMediaQuery(urlParams("")).flaggedOnly).toBe(true);
    expect(parseMediaQuery(urlParams("flaggedOnly=true")).flaggedOnly).toBe(
      true,
    );
    expect(parseMediaQuery(urlParams("flaggedOnly=junk")).flaggedOnly).toBe(
      true,
    );
    expect(parseMediaQuery(urlParams("flaggedOnly=false")).flaggedOnly).toBe(
      false,
    );
  });

  test("monitorStatus parses the four valid values + falls back to 'all'", () => {
    expect(parseMediaQuery(urlParams("")).monitorStatus).toBe("all");
    expect(
      parseMediaQuery(urlParams("monitorStatus=monitored")).monitorStatus,
    ).toBe("monitored");
    expect(
      parseMediaQuery(urlParams("monitorStatus=unmonitored")).monitorStatus,
    ).toBe("unmonitored");
    expect(
      parseMediaQuery(urlParams("monitorStatus=missing")).monitorStatus,
    ).toBe("missing");
    expect(
      parseMediaQuery(urlParams("monitorStatus=invalid")).monitorStatus,
    ).toBe("all");
  });
});

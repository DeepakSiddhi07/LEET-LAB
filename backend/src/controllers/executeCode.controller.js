import { db } from "../libs/db.js";
import {
  getLanguageName,
  poolBatchResult,
  submitBatch,
} from "../libs/judge0.lib.js";

/**
 * Maps a Judge0 status ID to our application's Status enum.
 * Judge0 status IDs: 1=In Queue, 2=Processing, 3=Accepted,
 * 4=Wrong Answer, 5=Time Limit Exceeded, 6=Compilation Error,
 * 7-12=Various runtime errors, 13=Internal Error, 14=Exec Format Error
 */
const getSubmissionStatus = (detailedResults) => {
  const hasCompileError = detailedResults.some((r) => r.compile_output);
  const hasRuntimeError = detailedResults.some(
    (r) => r.stderr && !r.compile_output
  );
  const allPassed = detailedResults.every((r) => r.passed);

  if (allPassed) return { status: "Accepted", allPassed: true };
  if (hasCompileError)
    return { status: "WrongAnswer", allPassed: false };
  if (hasRuntimeError)
    return { status: "WrongAnswer", allPassed: false };
  return { status: "WrongAnswer", allPassed: false };
};

export const executeCode = async (req, res) => {
  try {
    const { source_code, language_id, stdin, expected_outputs, problemId } =
      req.body;

    const userId = req.user.id;

    // --- 1. Input validation ---
    if (!source_code || typeof source_code !== "string" || !source_code.trim()) {
      return res.status(400).json({
        error: "Source code is required and cannot be empty",
        success: false,
      });
    }

    if (!language_id || typeof language_id !== "number") {
      return res.status(400).json({
        error: "A valid language ID is required",
        success: false,
      });
    }

    if (!problemId || typeof problemId !== "string") {
      return res.status(400).json({
        error: "A valid problem ID is required",
        success: false,
      });
    }

    if (
      !Array.isArray(stdin) ||
      stdin.length === 0 ||
      !Array.isArray(expected_outputs) ||
      expected_outputs.length !== stdin.length
    ) {
      return res.status(400).json({
        error:
          "Invalid test cases: stdin and expected_outputs must be non-empty arrays of equal length",
        success: false,
      });
    }

    // Verify the problem exists before executing
    const problemExists = await db.problem.findUnique({
      where: { id: problemId },
      select: { id: true },
    });

    if (!problemExists) {
      return res.status(404).json({
        error: "Problem not found",
        success: false,
      });
    }

    // --- 2. Prepare each test case for Judge0 batch submission ---
    const submissions = stdin.map((input) => ({
      source_code,
      language_id,
      stdin: input,
    }));

    // --- 3. Send batch to Judge0 ---
    const submitResponse = await submitBatch(submissions);

    const tokens = submitResponse.map((r) => r.token);

    // --- 4. Poll Judge0 for results ---
    const judgeResults = await poolBatchResult(tokens);

    // --- 5. Analyze test case results ---
    const detailedResults = judgeResults.map((judgeResult, i) => {
      const stdout = judgeResult.stdout?.trim() ?? null;
      const expected_output = expected_outputs[i]?.trim() ?? null;

      // A test case passes ONLY if Judge0 status is "Accepted" (id=3)
      // AND the output matches the expected output
      const passed =
        judgeResult.status.id === 3 && stdout === expected_output;

      return {
        testCase: i + 1,
        passed,
        stdout,
        expected: expected_output,
        stderr: judgeResult.stderr || null,
        compile_output: judgeResult.compile_output || null,
        status: judgeResult.status.description,
        memory: judgeResult.memory ? `${judgeResult.memory} KB` : null,
        time: judgeResult.time ? `${judgeResult.time} s` : null,
      };
    });

    // Determine overall submission status
    const { status: submissionStatus, allPassed } =
      getSubmissionStatus(detailedResults);

    // --- 6–8. Persist everything in a transaction for atomicity ---
    const submissionWithTestCases = await db.$transaction(async (tx) => {
      // 6. Store submission summary
      const submission = await tx.submission.create({
        data: {
          userId,
          problemId,
          sourcecode: source_code,
          language: getLanguageName(language_id),
          stdin: stdin.join("\n"),
          stdout: JSON.stringify(
            detailedResults.map((r) => r.stdout)
          ),
          stderr: detailedResults.some((r) => r.stderr)
            ? JSON.stringify(detailedResults.map((r) => r.stderr))
            : null,
          compileOutput: detailedResults.some((r) => r.compile_output)
            ? JSON.stringify(
                detailedResults.map((r) => r.compile_output)
              )
            : null,
          status: submissionStatus,
          memory: detailedResults.some((r) => r.memory)
            ? JSON.stringify(detailedResults.map((r) => r.memory))
            : null,
          time: detailedResults.some((r) => r.time)
            ? JSON.stringify(detailedResults.map((r) => r.time))
            : null,
        },
      });

      // 7. If all passed, mark problem as solved for this user
      if (allPassed) {
        await tx.problemSolved.upsert({
          where: {
            userId_problemId: {
              userId,
              problemId,
            },
          },
          update: {},
          create: {
            userId,
            problemId,
          },
        });
      }

      // 8. Save individual test case results
      await tx.testCaseResult.createMany({
        data: detailedResults.map((r) => ({
          submissionId: submission.id,
          testCase: r.testCase,
          passed: r.passed,
          stdout: r.stdout,
          expected: r.expected,
          stderr: r.stderr,
          compileOutput: r.compile_output,
          status: r.passed ? "Accepted" : "WrongAnswer",
          memory: r.memory,
          time: r.time,
        })),
      });

      // 9. Return submission with test cases included
      return tx.submission.findUnique({
        where: { id: submission.id },
        include: { testCases: true },
      });
    });

    // --- 10. Respond to client ---
    const passedCount = detailedResults.filter((r) => r.passed).length;
    const totalCount = detailedResults.length;

    res.status(200).json({
      success: true,
      message: allPassed
        ? "All test cases passed!"
        : `${passedCount}/${totalCount} test cases passed`,
      submission: submissionWithTestCases,
    });
  } catch (error) {
    console.error("Error executing code:", error.message);
    res.status(500).json({
      error: "Failed to execute code. Please try again later.",
      success: false,
    });
  }
};

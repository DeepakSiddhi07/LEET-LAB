import { db } from "../libs/db.js";
import {
  getLanguageName,
  poolBatchResult,
  submitBatch,
} from "../libs/judge0.lib.js";

export const executeCode = async (req, res) => {
  try {
    const { source_code, language_id, stdin, expected_outputs, problemId } =
      req.body;
    console.log("Req Body for EXECUTE_CODE:", req.body);

    const userId = req.user.id;
    // console.log("User ID EXECUTE-CODE:", userId);

    //1.//validate testcases
    if (
      !Array.isArray(stdin) ||
      stdin.length === 0 ||
      !Array.isArray(expected_outputs) ||
      expected_outputs.length !== stdin.length
    ) {
      // console.log("Invalid testcases");
      return res.status(400).json({
        error: "Invalid testcases",
        success: false,
      });
    }

    // console.log("Testcases are valid");

    //2.//Prepare each testcase for judge0 batch submission
    const submissions = stdin.map((input) => ({
      source_code,
      language_id,
      stdin: input,
    }));
    // console.log("Submissions:", submissions);

    //3.//Send this batch of submissions to judge0
    const submitResponse = await submitBatch(submissions);

    // console.log("Submit Response:", submitResponse);

    const tokens = submitResponse.map((res) => res.token);
    // console.log("Tokens:", tokens);

    //4.//Pool judge0 for result of all submitted test cases
    const result = await poolBatchResult(tokens);

    // console.log("Result-----------------------------------:");
    // console.log(result);

    //5.// Analyze the testcase results
    let allPassed = true;
    const detailedResults = result.map((result, i) => {
      const stdout = result.stdout?.trim();
      const expected_output = expected_outputs[i]?.trim();
      const passed = stdout === expected_output;

      // console.log(`Testcase ${i+1} `);
      // console.log(`Input: ${stdin[i]}`);
      // console.log(`Expected Output for testcase : ${expected_outputs[i]}`);
      // console.log(`Actual Output for testcase : ${stdout}`);

      // console.log(`Matched :${passed}`);

      return {
        testCase: i + 1,
        passed,
        stdout,
        expected: expected_output,
        stderr: result.stderr || null,
        compile_output: result.compile_output || null,
        status: result.status.description,
        memory: result.memory ? `${result.memory} KB` : undefined,
        time: result.time ? `${result.time} s` : undefined,
      };
    });

    // console.log("DetailedResults--------", detailedResults);

    //6.// Store Submission summary in db
    const submission = await db.submission.create({
      data: {
        userId,
        problemId,
        sourcecode: source_code,
        language: getLanguageName(language_id),
        stdin: stdin.join("\n"),
        stdout: JSON.stringify(detailedResults.map((result) => result.stdout)),
        stderr: detailedResults.some((result) => result.stderr)
          ? JSON.stringify(detailedResults.map((result) => result.stderr))
          : null,
        compileOutput: detailedResults.some((result) => result.compile_output)
          ? JSON.stringify(
              detailedResults.map((result) => result.compile_output)
            )
          : null,
        status: allPassed ? "Accepted" : "WrongAnswer",
        memory: detailedResults.some((result) => result.memory)
          ? JSON.stringify(detailedResults.map((result) => result.memory))
          : null,
        time: detailedResults.some((res) => res.time)
          ? JSON.stringify(detailedResults.map((res) => res.time))
          : null,
      },
    });

    //7.//If allPassed = true mark problem is solved for the current user
    if (allPassed) {
      await db.ProblemSolved.upsert({
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

    //8.//Save individual testcase Result
    const testCaseResult = detailedResults.map((result) => ({
      submissionId: submission.id, //it coming from the submission (//6.// Store Submission summary in db)
      testCase: result.testCase,
      passed: result.passed,
      stdout: result.stdout,
      expected: result.expected,
      stderr: result.stderr,
      compileOutput: result.compile_output,
      status: result.status,
      memory: result.memory,
      time: result.time,
    }));
    await db.TestCaseResult.createMany({
      data: testCaseResult,
    });

    //9.//Show the overall submission to user
    const submissionWithTestCases = await db.submission.findUnique({
      where: {
        id: submission.id,
      },
      include: {
        testCases: true,
      },
    });

    res.status(200).json({
      success: true,
      message: "Code executed successfully",
      submission: submissionWithTestCases,
    });
  } catch (error) {
    console.log("Error in executing code", error);
    res.status(500).json({
      error: "Error in executing code",
      success: false,
    });
  }
};

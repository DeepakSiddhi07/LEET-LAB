import { db } from "../libs/db.js";
import {
  getJudge0LanguageId,
  poolBatchResult,
  submitBatch,
} from "../libs/judge0.lib.js";

/**
 * POST /api/v1/problems/create-problem
 *
 * Creates a new problem after validating ALL reference solutions
 * against ALL test cases via Judge0.
 *
 * Key fix: The DB save now happens AFTER the entire validation loop,
 * ensuring every language's solution is verified before persisting.
 */
export const createProblem = async (req, res) => {
  const {
    title,
    description,
    difficulty,
    tags,
    examples,
    constraints,
    testcases,
    codeSnippets,
    referenceSolutions,
    company,
    category,
  } = req.body;

  // Defense-in-depth: verify admin role even though middleware checks it
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      error: "You are not allowed to create a problem",
      success: false,
    });
  }

  try {
    // ─── Step 1: Validate ALL reference solutions against test cases ───
    // We must verify EVERY language passes EVERY test case before saving.
    for (const [language, solutionCode] of Object.entries(referenceSolutions)) {
      const languageId = getJudge0LanguageId(language);

      if (!languageId) {
        return res.status(400).json({
          error: `Language "${language}" is not supported`,
          success: false,
        });
      }

      // Prepare Judge0 batch submission for all test cases
      const submissions = testcases.map(({ input, output }) => ({
        source_code: solutionCode,
        language_id: languageId,
        stdin: input,
        expected_output: output,
      }));

      const submissionResult = await submitBatch(submissions);
      const tokens = submissionResult.map((r) => r.token);
      const results = await poolBatchResult(tokens);

      // Check every test case passed for this language
      for (let i = 0; i < results.length; i++) {
        if (results[i].status.id !== 3) {
          return res.status(400).json({
            error: `Testcase ${i + 1} failed for language ${language}: ${results[i].status.description}`,
            success: false,
          });
        }
      }
    }

    // ─── Step 2: ALL languages validated — now save to database ───────
    const newProblem = await db.problem.create({
      data: {
        title,
        description,
        difficulty,
        tags,
        company,
        category,
        examples,
        constraints,
        testcases,
        codeSnippets,
        referenceSolutions,
        userId: req.user.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Problem created successfully",
      problem: newProblem,
    });
  } catch (error) {
    console.error("Error creating problem:", error.message);
    return res.status(500).json({
      error: "Error while creating problem",
      success: false,
    });
  }
};

export const getAllProblems = async (req, res) => {
  try {
    const problems = await db.problem.findMany(
      {
        include:{
          solvedBy:{
            where:{
              userId:req.user.id
            }
          }
        }
      }
    )

    if(!problems || problems.length === 0)
    {
      return res.status(404).json({
        error: "No problems found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Problems fetched successfully",
      success: true,
      problems,
    });

  } catch (error) {
    
    console.error("Error in fetching problems:", error.message);
    return res.status(500).json({
      error: "Error while fetching problems",
      success: false,
    });
  }
};

export const getProblemById = async (req, res) => {
  const {id} = req.params;

  try {
    const problem = await db.problem.findUnique({
      where:{
        id:id
      }
    })

    if(!problem)
    {
      return res.status(404).json({
        error: "Problem not found",
        success: false,
      });
    }
    return res.status(200).json({
      message: "Problem fetched successfully",
      success: true,
      problem,
    });
  } catch (error) {
    console.error("Error in fetching problem:", error.message);
    return res.status(500).json({
      error: "Error while fetching problem by id",
      success: false,
    });
  }
};

/**
 * PUT /api/v1/problems/update-problem/:id
 *
 * Updates an existing problem after re-validating ALL reference solutions
 * against ALL test cases via Judge0.
 *
 * Key fixes:
 * - Validates test results for EVERY language (with failure messages)
 * - Actually performs the `db.problem.update()` call
 * - Proper error handling in both catch blocks (no silent swallowing)
 */
export const updateProblem = async (req, res) => {
  const { id } = req.params;

  try {
    // ─── Step 1: Verify problem exists ────────────────────────────────
    const problem = await db.problem.findUnique({
      where: { id },
    });

    if (!problem) {
      return res.status(404).json({
        error: "Problem not found",
        success: false,
      });
    }

    // ─── Step 2: Verify admin role (defense-in-depth) ─────────────────
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        error: "You are not allowed to update a problem",
        success: false,
      });
    }

    const {
      title,
      description,
      difficulty,
      tags,
      company,
      examples,
      constraints,
      testcases,
      codeSnippets,
      referenceSolutions,
      category,
    } = req.body;

    // ─── Step 3: Validate ALL reference solutions against test cases ──
    for (const [language, solutionCode] of Object.entries(referenceSolutions)) {
      const languageId = getJudge0LanguageId(language);

      if (!languageId) {
        return res.status(400).json({
          error: `Language "${language}" is not supported`,
          success: false,
        });
      }

      const submissions = testcases.map(({ input, output }) => ({
        source_code: solutionCode,
        language_id: languageId,
        stdin: input,
        expected_output: output,
      }));

      const submissionResult = await submitBatch(submissions);
      const tokens = submissionResult.map((r) => r.token);
      const results = await poolBatchResult(tokens);

      // Check every test case passed for this language
      for (let i = 0; i < results.length; i++) {
        if (results[i].status.id !== 3) {
          return res.status(400).json({
            error: `Testcase ${i + 1} failed for language ${language}: ${results[i].status.description}`,
            success: false,
          });
        }
      }
    }

    // ─── Step 4: ALL languages validated — update the database ────────
    const updatedProblem = await db.problem.update({
      where: { id },
      data: {
        title,
        description,
        difficulty,
        tags,
        company,
        category,
        examples,
        constraints,
        testcases,
        codeSnippets,
        referenceSolutions,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Problem updated successfully",
      problem: updatedProblem,
    });
  } catch (error) {
    console.error("Error updating problem:", error.message);
    return res.status(500).json({
      error: "Error while updating problem",
      success: false,
    });
  }
};


export const deleteProblem = async (req, res) => {
  try {
    const {id} = req.params;
  
    const problem = await db.problem.findUnique({where:{id}});
  
    if(!problem)
    {
      return res.status(404).json({
        error:"Problem not found",
        success:false
      })
    }
  
    await db.problem.delete({where:{id}})

  res.status(200).json({
    success:true,
    message:"Problem deleted successfully"
  })
  } catch (error) {
  console.error("Error in deleting problem:", error.message);
  return res.status(500).json({
    error: "Error while deleting the problem by id",
    success: false,
  });
  }
};

export const getAllProblemsSolveByUser = async (req, res) => {
  try {
    const problems = await db.problem.findMany({
      where:{
        solvedBy:{
          some:{
            userId:req.user.id
          }
        }
      },
      include:{
        solvedBy:{
          where:{
            userId:req.user.id
          }
        }
      }
    })

    res.status(200).json({
      success:true,
      message:"Problems fetched successfully",
      problems
    })
  } catch (error) {
    console.error("Error in fetching problems:", error.message);
    return res.status(500).json({
      error: "Error while fetching problems",
      success: false,
    });
    
  }
};

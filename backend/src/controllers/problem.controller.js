import { db } from "../libs/db.js";
import {
  getJudge0LanguageId,
  poolBatchResult,
  submitBatch,
} from "../libs/judge0.lib.js";

export const createProblem = async (req, res) => {
  //going to get all the data from the req body
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
    category
  } = req.body;

  console.log("Request Body:", req.body);

  //going to check the user role once again (ki ye admin hai ki nahi hai)

  if (req.user.role !== "ADMIN") {
    console.log("User is not admin");

    return res.status(403).json({
      error: "You are not allow to create a problem",
      success: false,
    });
  }
  //Loop through the each reference solution for different languages

  console.log("USER IS ", req.user.role);

  try {
    for (const [language, solutionCode] of Object.entries(referenceSolutions)) {
      // Check if the language is supported by judge0
      //  Get judge0 Language id for the current language
      const languageId = getJudge0LanguageId(language);

      if (!languageId) {
        return res
          .status(400)
          .json({
            error: `${language} Language is not supported`,
            success: false,
          });
      }

      //Prepare judge0 submission for all testcases

      const submissions = testcases.map(({ input, output }) => ({
        source_code: solutionCode,
        language_id: languageId,
        stdin: input,
        expected_output: output,
      }));

      console.log("Submissions Payload:", submissions);

      const submissionResult = await submitBatch(submissions); // submit the batch to judge0
      console.log("Submission Result:", submissionResult);

      const tokens = submissionResult.map((res) => res.token); // returned by the judge0 (when we call the api /submissions/batch?base64_encoded=false)
      console.log("Submission Result:", submissionResult);
      console.log("Tokens:", tokens);

      const results = await poolBatchResult(tokens); // get the results token and the check the status of the tokens (which is not == 1,2) and then run again after the sleep time
      console.log("Results:", results);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];

        console.log("RESULT----->", result);

        // console.log(`Testcase ${i+1} and Language ${language}------ result ${JSON.stringify(result.status.description)}`);

        if (result.status.id !== 3) {
          console.log("Result is not 3", result);
          return res.status(400).json({
            error: `Testcase ${i + 1} failed for language ${language}`,
            success: false,
          });
        }
      }

      //save the problem into the database

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
        message: "Problem created successful",
        Problem: newProblem,
      });
    }
  } catch (error) {
    console.log("Error creating problem:", error);
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
    
    console.log("Error in fetching problems:", error);
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
    console.log("Error in fetching problem:", error);
    return res.status(500).json({
      error: "Error while fetching problem by id",
      success: false,
    });
  }
};

export const updateProblem = async (req, res) => {
  const {id} = req.params;

  try {
    const problem = await db.problem.findUnique(
      {
        where:{
          id:id
        }
      }
    )


    if(!problem || problem.length === 0)
    {
      return res.status(404).json({
        error: "Problem not found",
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
    } = req.body;

    //going to check the user role once again (ki ye admin hai ki nahi hai)
    if(req.user.role !== "ADMIN" )
    {
      console.log("User is not admin");
      return res.status(403).json({
        error: "You are not allow to update a problem",
        success: false,
      });
      
    }

    try {
      for(const [language,solutionCode] of Object.entries(referenceSolutions))
      {
        const languageId = getJudge0LanguageId(language);

        if(!languageId)
        {
          return res
          .status(400)
          .json({
            error: `${language} Language is not supported`,
            success: false,
          });
        }

        const submissions = testcases.map(({input,output})=>{
          return {
            source_code: solutionCode,
            language_id: languageId,
            stdin: input,
            expected_output: output,
          };
        });

        const submissionResult = await submitBatch(submissions);

        const tokens = submissionResult.map((res)=> res.token);

        const results = await poolBatchResult(tokens);


      }
    } catch (error) {
      
    }


  } catch (error) {
    
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
    message:"Problem delete successfully"
  })
  } catch (error) {
  console.log("Error in deleting problem",error);
  return res.status(500).json({
    error: "Error while deleting the  problem by id",
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
    console.log("Error in fetching problems:", error);
    return res.status(500).json({
      error: "Error while fetching problems",
      success: false,
    });
    
  }
};

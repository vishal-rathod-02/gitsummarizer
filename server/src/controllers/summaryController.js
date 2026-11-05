import {
  validateCreateSummaryRequest,
  validatePaginationQuery,
  validateSummaryIdParam
} from "../validators/summaryValidator.js";
import {
  createSummary,
  getSummaryHistory,
  getSummaryDetail,
  removeSummary
} from "../services/summaryService.js";

export async function generateSummary(req, res, next) {
  try {
    const validated = validateCreateSummaryRequest(req.body);
    const userId = req.user ? req.user.id : null;

    const data = await createSummary({
      repositoryUrl: validated.repositoryUrl,
      commitRef: validated.commitRef,
      commitLimit: validated.commitLimit,
      userId
    });

    return res.status(201).json({
      success: true,
      data
    });
  } catch (err) {
    return next(err);
  }
}

export function listSummaryHistory(req, res, next) {
  try {
    const { page, limit } = validatePaginationQuery(req.query);
    const userId = req.user ? req.user.id : null;

    const result = getSummaryHistory({
      userId,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

export function getSummaryById(req, res, next) {
  try {
    const summaryId = validateSummaryIdParam(req.params);
    const userId = req.user ? req.user.id : null;

    const data = getSummaryDetail({
      summaryId,
      userId
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    return next(err);
  }
}

export function deleteSummaryById(req, res, next) {
  try {
    const summaryId = validateSummaryIdParam(req.params);
    const userId = req.user ? req.user.id : null;

    removeSummary({
      summaryId,
      userId
    });

    return res.status(200).json({
      success: true,
      message: "Summary deleted."
    });
  } catch (err) {
    return next(err);
  }
}

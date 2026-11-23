import {
  validateRegisterInput,
  validateLoginInput
} from "../validators/authValidator.js";
import {
  registerUser,
  loginUser,
  createDemoSession,
  getAuthenticatedUser
} from "../services/authService.js";

export function register(req, res, next) {
  try {
    const { name, email, password } = validateRegisterInput(req.body);
    const result = registerUser({ name, email, password });

    return res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    return next(err);
  }
}

export function login(req, res, next) {
  try {
    const { email, password } = validateLoginInput(req.body);
    const result = loginUser({ email, password });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    return next(err);
  }
}

export function demoSession(_req, res, next) {
  try {
    const result = createDemoSession();
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    return next(err);
  }
}

export function logout(_req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully."
  });
}

export function me(req, res, next) {
  try {
    const user = getAuthenticatedUser(req.user.id, req.user);
    return res.status(200).json({
      success: true,
      data: { user }
    });
  } catch (err) {
    return next(err);
  }
}

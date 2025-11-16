const UserAvatar = ({ username }) => {
  const letter = username ? username[0].toUpperCase() : "?";

  return (
    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
      {letter}
    </div>
  );
};

export default UserAvatar;

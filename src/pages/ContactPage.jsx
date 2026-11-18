// eslint-disable tailwindcss/no-custom-classname
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGithub,
  faLinkedin,
  faInstagram,
} from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";

function ContactPage() {
  const currentUser = useSelector((state) => state.auth.currentUser);
  const contactChannels = [
    {
      title: "Email",
      subtitle: "venu.kasibhatla@gmail.com",
      href: "mailto:venu.kasibhatla@gmail.com",
      icon: faEnvelope,
      bgColor: "bg-(--panel)",
      iconColor: "text-(--muted)",
    },
    {
      title: "GitHub",
      subtitle: "@notvenu",
      href: "https://github.com/notvenu",
      icon: faGithub,
      bgColor: "bg-(--panel)",
      iconColor: "text-(--muted)",
    },
    {
      title: "LinkedIn",
      subtitle: "Venu Bhargava Jishith Kasibhatla",
      href: "https://linkedin.com/in/venu-kasibhatla",
      icon: faLinkedin,
      bgColor: "bg-(--panel)",
      iconColor: "text-(--muted)",
    },
    {
      title: "Instagram",
      subtitle: "@veeennnuuu",
      href: "https://instagram.com/veeennnuuu",
      icon: faInstagram,
      bgColor: "bg-(--panel)",
      iconColor: "text-(--muted)",
    },
  ];

  return (
    <div className="animate-fadeIn w-full max-w-4xl mx-auto px-4 py-8">
      {currentUser && (
        <>
          {/* Contact Section */}
          <div className="mb-12">
            <h1 className="text-3xl font-medium text-(--text) mb-3">
              Contact
            </h1>
            <p className="text-base text-(--muted) mb-8">
              Questions or suggestions? Reach out on any of these channels
            </p>

            {/* Contact Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contactChannels.map((channel) => (
                <a
                  key={channel.title}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl border border-(--line) bg-(--bg-elev) hover:border-(--muted) transition-colors"
                >
                  <FontAwesomeIcon
                    icon={channel.icon}
                    className={`h-5 w-5 shrink-0 ${channel.iconColor}`}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-(--text)">
                      {channel.title}
                    </p>
                    <p className="text-sm text-(--muted)">
                      {channel.subtitle}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-(--line) my-12"></div>
        </>
      )}
      {/* Contribute Section */}
      <div>
        {currentUser ? (
          <h2 className="text-3xl font-medium text-(--text) mb-4">
            Contribute on GitHub
          </h2>
        ) : (
          <h1 className="text-3xl font-medium text-(--text) mb-4">
            Contribute on GitHub
          </h1>
        )}
        <p className="text-base text-(--muted) mb-8">
          Found a bug or have a feature idea? Contribute to the project
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://github.com/notvenu/KnowYourFaculty/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-xl border border-(--line) bg-(--bg-elev) p-6 transition-colors hover:border-(--muted)"
          >
            <FontAwesomeIcon
              icon={faGithub}
              className="text-2xl text-(--muted) mt-1 shrink-0"
            />
            <div className="flex-1">
              <p className="font-medium text-(--text)">
                Report an issue
              </p>
              <p className="text-sm text-(--muted)">
                Found a bug? Tell us
              </p>
            </div>
          </a>

          <a
            href="https://github.com/notvenu/KnowYourFaculty/pulls"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 rounded-xl border border-(--line) bg-(--bg-elev) p-6 transition-colors hover:border-(--muted)"
          >
            <FontAwesomeIcon
              icon={faGithub}
              className="text-2xl text-(--muted) mt-1 shrink-0"
            />
            <div className="flex-1">
              <p className="font-medium text-(--text)">
                Submit a pull request
              </p>
              <p className="text-sm text-(--muted)">
                Got an improvement? Open a PR
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}

export default ContactPage;

